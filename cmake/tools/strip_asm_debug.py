#!/usr/bin/env python3
"""Split each -save-temps assembly file into a lean and a debug version.

For every object passed, the matching foo.s (written by the compiler) is
moved to foo.debug.s, and foo.s is rewritten without debug info:
  - __DWARF sections dropped
  - .file/.loc directives replaced by "; file.cpp:LINE" comments when the line changes
  - ;DEBUG_VALUE comments dropped
Instructions, labels, other comments and exception tables are kept as-is.
Debug info does not change code generation, so the instructions are the
same ones a build without -g would produce.

Files without __DWARF sections (already processed, or built without -g)
are left alone, so this is safe to run after every build.
"""
import re
import sys
from pathlib import Path

FILE_RE = re.compile(r'^\s*\.file\s+(\d+)\s+"([^"]*)"(?:\s+"([^"]*)")?')
LOC_RE = re.compile(r"^\s*\.loc\s+(\d+)\s+(\d+)")
SECTION_RE = re.compile(r"^\s*(\.section\s+(\S+?),|\.(text|data|const|cstring)\b|\.subsections_via_symbols)")


def asm_for(obj: Path) -> Path | None:
    # Clang names temps after the source file: CMake's foo.cpp.o -> foo.s.
    for candidate in (obj.with_suffix("").with_suffix(".s"), obj.with_suffix(".s")):
        if candidate.exists():
            return candidate
    return None


def strip(text: str) -> str:
    files: dict[str, str] = {}
    out: list[str] = []
    in_dwarf = False
    last_loc: tuple[str, str] | None = None

    for line in text.splitlines():
        if m := SECTION_RE.match(line):
            in_dwarf = bool(m[2] and m[2].startswith("__DWARF"))
            last_loc = None
        if in_dwarf:
            continue
        if m := FILE_RE.match(line):
            files[m[1]] = Path(m[3] or m[2]).name
            continue
        if m := LOC_RE.match(line):
            loc = (m[1], m[2])
            if loc != last_loc and m[2] != "0":  # line 0 = compiler-generated code
                out.append(f"\t; {files.get(m[1], '?')}:{m[2]}")
            last_loc = loc
            continue
        if line.lstrip().startswith(";DEBUG_VALUE:") or line.lstrip().startswith(";DEBUG_LABEL:"):
            continue
        out.append(line)
    return "\n".join(out) + "\n"


def main() -> int:
    for obj in sys.argv[1:]:
        asm = asm_for(Path(obj))
        if asm is None:
            continue
        text = asm.read_text()
        if "__DWARF" not in text:
            continue
        asm.with_suffix(".debug.s").write_text(text)
        asm.write_text(strip(text))
    return 0


if __name__ == "__main__":
    sys.exit(main())
