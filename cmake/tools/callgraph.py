#!/usr/bin/env python3
"""Build a filtered, demangled call graph from the .bc files kept by -save-temps.

Usage: callgraph.py --llvm-link L --opt O --cxxfilt F [--dot D] --filter RE --out PREFIX obj.o...
Writes PREFIX.dot (and PREFIX.svg when graphviz `dot` is given).
"""
import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path


def bitcode_for(obj: Path) -> Path | None:
    # Clang names temps after the source file, in the object's directory:
    # CMake's foo.cpp.o -> foo.bc; a plain foo.o -> foo.bc.
    for candidate in (obj.with_suffix("").with_suffix(".bc"), obj.with_suffix(".bc")):
        if candidate.exists():
            return candidate
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--llvm-link", required=True)
    ap.add_argument("--opt", required=True)
    ap.add_argument("--cxxfilt", required=True)
    ap.add_argument("--dot", default="")
    ap.add_argument("--filter", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("objects", nargs="+")
    args = ap.parse_args()

    bitcode = [bc for o in args.objects if (bc := bitcode_for(Path(o)))]
    if not bitcode:
        print("callgraph: no .bc files found; is LIGHTHOUSE_EMIT_ARTIFACTS on?", file=sys.stderr)
        return 1

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        linked = Path(tmp) / "linked.bc"
        subprocess.run([args.llvm_link, *map(str, bitcode), "-o", str(linked)], check=True)
        # dot-callgraph writes <input>.callgraph.dot into the working directory.
        subprocess.run([args.opt, "-passes=dot-callgraph", "-disable-output", str(linked)],
                       check=True, cwd=tmp, stdout=subprocess.DEVNULL)
        raw = (Path(tmp) / "linked.bc.callgraph.dot").read_text()

    node_re = re.compile(r'^\s*(Node0x[0-9a-f]+) \[shape=record,label="\{(.*)\}"\];$')
    edge_re = re.compile(r"^\s*(Node0x[0-9a-f]+) -> (Node0x[0-9a-f]+);$")

    mangled: dict[str, str] = {}
    edges: set[tuple[str, str]] = set()
    for line in raw.splitlines():
        if m := node_re.match(line):
            mangled[m[1]] = m[2]
        elif m := edge_re.match(line):
            edges.add((m[1], m[2]))

    ids = list(mangled)
    demangled = subprocess.run([args.cxxfilt], input="\n".join(mangled[i] for i in ids),
                               capture_output=True, text=True, check=True).stdout.splitlines()
    names = dict(zip(ids, demangled))

    # Merge nodes with the same demangled name (e.g. C1/C2 constructor variants).
    keep_re = re.compile(args.filter)
    node_of = {i: names[i] for i in ids if keep_re.search(names[i])}
    kept = sorted(set(node_of.values()))
    node_id = {n: f"n{k}" for k, n in enumerate(kept)}
    merged = {(node_of[a], node_of[b]) for a, b in edges
              if a in node_of and b in node_of and node_of[a] != node_of[b]}

    def esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace('"', '\\"')

    lines = ["digraph callgraph {", "  rankdir=LR;", '  node [shape=box, fontname="Menlo", fontsize=10];']
    lines += [f'  {node_id[n]} [label="{esc(n)}"];' for n in kept]
    lines += [f"  {node_id[a]} -> {node_id[b]};" for a, b in sorted(merged)]
    lines.append("}")

    dot_path = out.with_suffix(".dot")
    dot_path.write_text("\n".join(lines) + "\n")
    print(f"callgraph: {len(kept)} functions -> {dot_path}")

    if args.dot:
        svg_path = out.with_suffix(".svg")
        subprocess.run([args.dot, "-Tsvg", str(dot_path), "-o", str(svg_path)], check=True)
        print(f"callgraph: {svg_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
