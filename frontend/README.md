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

## Talking to a real backend

Copy `.env.example` to `.env.local`:

```sh
VITE_API_MODE=http
VITE_API_BASE_URL=https://api.your-env.example
```

In `mock` mode an MSW service worker answers every `/v1` request from an
in-memory database seeded with 2,481 leads; poke at it from devtools via
`window.__lighthouseMockDb`.

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
