# E2E: the ride flow, two ways

Two user journeys, each run twice (`api` HTTP / `ui` Chromium):

| Spec     | Journey                                                            |
| -------- | ------------------------------------------------------------------ |
| `ride`   | request → schedule → start → pickup → dropoff (full lifecycle)     |
| `routeA` | student creates, admin schedules, lists agree (stops at Scheduled) |

| Project | How                        | Tells you                                 |
| ------- | -------------------------- | ----------------------------------------- |
| `api`   | HTTP calls, no browser     | backend works (route handlers, DB, rules) |
| `ui`    | Chromium driving the pages | frontend works on top of a known backend  |

Read them together: red `api` = backend, stop there. Green `api` + red `ui` =
frontend; the failed test's **diagnostics** attachment lists every failed
`/api` response, network error and page error, with a one-line verdict.

**Notes:** run once, `npx playwright install chromium`
to run together use `npm run test:e2e`, both projects
to run ui agnostic, use `npm run test:e2e:api`
to run using ui, use `npm run test:e2e:ui`, backend only, ~15s warm
read report using `npm run test:e2e:report`, open the HTML report + diagnostics

## How a run works

1. `playwright.config.ts` runs `next build && next start` on port **:3100** with
   its own env: database `able-alliance-e2e`, the dev secret, empty Mapbox
   tokens (no outbound calls). Port 3100 so it never collides with your dev
   server or docker compose. A production build (~30s) rather than `next dev`
   because dev compiles routes on demand, hard-reloads pages mid-flow and
   races its own manifests, which made the UI flow flaky.
2. `seed.ts` (global setup) wipes that db and inserts one student, one
   driver on shift all week, one admin, three locations, one vehicle. Fixed
   ids. No rides: each flow creates its own.
3. Specs log in by **minting the session cookie** (`fixtures.ts`) with the same
   `encode()` call the CAS callback uses. CAS is never involved.
4. Playwright stops the server.

Needs a Mongo on `localhost:27017` (compose's is fine; a different DB name is used).

Knobs: `E2E_BASE_URL`, `E2E_MONGODB_URI`, `E2E_NEXTAUTH_SECRET`,
`E2E_SESSION_COOKIE`, `E2E_EXTERNAL_SERVER=1` (don't launch; app already at
`E2E_BASE_URL` — expect flakiness if that app is `next dev`),
`E2E_ALLOW_ANY_DB=1` (let the seed wipe a non-e2e DB name).

## Adding a flow

Name it `<thing>.api.spec.ts` and/or `<thing>.ui.spec.ts`; the config routes
them to the right project by suffix. Import `test`/`expect` from `./fixtures`,
log in with `apiAs()` or `pageAs()`, and create whatever rides the flow needs
inside the test. Add to `seed.ts` only when a new _kind_ of thing must
pre-exist (another persona, location, vehicle).

```


## Known rough edges

- The ride detail page opens a socket.io connection to `:4000`; no websocket
  server runs here, so `diag` will list those as network failures (not `/api`,
  so they don't affect the verdict).
- `ui` selectors use roles, labels and text. Adding `data-testid` to the
  time input, the admin table dropdowns and the driver buttons is the first
  hardening step.
- Adding the real CAS journey later is one more project plus the mock CAS
  server in `webServer`; the minted-session design keeps it optional.
```
