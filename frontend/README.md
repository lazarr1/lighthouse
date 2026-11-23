# Lighthouse web client

Production version of the `ui-prototype`: Dashboard, Data and Actions views
with an AI assistant, built against an API **contract** and a working mock of
it, so it runs end-to-end without the backend.

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Backend the client needs: [docs/BACKEND.md](docs/BACKEND.md)
- Wire contract: [docs/openapi.json](docs/openapi.json) — or open **`/dev/api`** in the running app

## Quick start

Requires Node ≥ 20.19.

```sh
npm install
npm run dev          # http://localhost:5173 — uses the in-browser mock backend
```

## Scripts

| Script                                                  | What it does                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                                           | Vite dev server.                                                                  |
| `npm run build`                                         | Typecheck + production build to `dist/`.                                          |
| `npm test` / `npm run test:watch`                       | Vitest (unit, contract, full-app integration).                                    |
| `npm run test:coverage`                                 | Tests with V8 coverage.                                                           |
| `npm run typecheck` / `npm run lint` / `npm run format` | Static checks.                                                                    |
| `npm run check`                                         | Typecheck + lint + tests (use in CI).                                             |
| `npm run contract:openapi`                              | Regenerate `docs/openapi.json` from the Zod contract. A test fails if you forget. |

## Developing against a local backend

You don't have to finish the whole API before connecting it. Implement a few
endpoints, mark them **live**, and the rest stay mocked.

**1. Point the dev server at your backend.** Create `.env.local` (git-ignored):

```sh
VITE_API_MODE=hybrid
VITE_API_PROXY_TARGET=http://localhost:8080   # your C++ server
VITE_LIVE_ENDPOINTS=getSession, getWorkspace   # names, tags (Records, Dashboards…) or *
```

Restart `npm run dev`. Vite proxies `/v1` to your server, so the browser sees
one origin: no CORS setup, and session cookies work. Endpoints not listed are
answered by the in-browser mock. The top bar shows `Hybrid · N live`, and
`/dev/api` marks which endpoints are live.

Once everything is implemented, switch to `VITE_API_MODE=http` (keep
`VITE_API_BASE_URL` empty to keep using the proxy).

**2. Check it against the contract.** With your backend running:

```sh
npm run contract:check                        # read-only walk through the API
npm run contract:check -- --writes            # also create/edit/conflict/delete/undo a scratch record
npm run contract:check -- --only "Session, Records"
npm run contract:check -- http://localhost:9000 --header "Authorization: Bearer …"
```

It follows whatever IDs your server returns and validates every response
against the schemas. Each check reports ✓ pass, ✗ fail (with the offending
field), · not implemented, or – skipped. The exit code is 1 on any failure, so
it can gate CI.

**3. Keep IDs consistent.** In hybrid mode, live and mocked endpoints must agree
on IDs. For example, if your `getSession` returns a workspace the mock doesn't
know, the mocked endpoints will 404. Either make endpoints live in vertical
slices (`Session` together, `Records` together), or seed your database with the
mock's exact data:

```sh
npm run fixtures:export   # → fixtures/seed.json: workspace, dataset + 2,481 records, dashboard, actions, runs
```

In the browser, a live response that doesn't match the contract shows up as a
`contract_violation` error in the UI, with the Zod issues logged to the console.

## Changing the API

The contract lives in `src/api/contract/`. Edit a schema or endpoint there,
then let `npm run typecheck` show you every call site and mock handler to
update, regenerate the OpenAPI file, and run the tests. See
[ARCHITECTURE.md §9](docs/ARCHITECTURE.md#9-changing-the-api).

## Notes

- `.npmrc` sets `legacy-peer-deps` to work around an npm resolver crash with
  Vitest 4's optional peers; all needed peers are declared explicitly.
- Keyboard: ⌘K opens the assistant; in the grid, Enter edits, Shift+Enter opens
  the record, ⌘D fills down, ⌘Z undoes.
