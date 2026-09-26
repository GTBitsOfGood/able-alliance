# CAS / GT SSO integration

How this app authenticates against Georgia Tech's Central Authentication
Service, and how it compares to the integration GT publishes as a reference.

## Identity model

**The GT Account username (`cas:user`) is the primary identity.** A user is
matched by the `gtUsername` field on their record; email and display name are
optional CAS attributes that never participate in the lookup.

This mirrors GT's own reference integration, and it is also the only choice the
CAS protocol guarantees: every successful `/p3/serviceValidate` response carries
`<cas:user>`, while attribute release is configured per registered service and
may be empty.

Users are **never auto-provisioned**. A successful CAS login for someone with no
record here is a failed login (`?error=user_not_found`) — the Office of
Disability Services provisions accounts.

## Flow

| Step        | Route                                    | Notes                                                                |
| ----------- | ---------------------------------------- | -------------------------------------------------------------------- |
| 1. Sign in  | `GET /api/auth/cas/login`                | Redirects to `{CAS}/login?service=…`                                 |
| 2. Return   | `GET /api/auth/cas/callback?ticket=ST-…` | Validates the ticket server-to-server, then mints the session cookie |
| 3. Sign out | `GET /api/auth/cas/logout`               | Clears the session cookie, then redirects to `{CAS}/logout`          |

The `service` parameter must be **byte-identical** between step 1 and the
validation call in step 2 or CAS rejects it. Both are built by
`casServiceUrl()` in `src/server/cas/config.ts` so they cannot drift.

## Configuration

| Variable               | Used for                                       |
| ---------------------- | ---------------------------------------------- |
| `CAS_BASE_URL_BROWSER` | Where the _browser_ is sent (login, logout)    |
| `CAS_BASE_URL`         | Where the _server_ validates tickets           |
| `DEPLOY_PRIME_URL`     | This app's own origin; the `service` parameter |

Two CAS URLs exist only because the mock server runs in Docker: the browser
reaches it at `localhost:8443`, the app container at `cas:8443`. Against real GT
CAS (`https://sso.gatech.edu/cas`) both hold the same value.

`readCASConfig()` validates all three are present and are absolute `http(s)`
URLs. On failure the routes redirect to `/login?error=cas_misconfigured` rather
than throwing a 500. Logout clears the local session cookie **even when CAS is
misconfigured** — an unreachable CAS must never leave someone logged in here.

## Local development

`mock-cas-server/` implements CAS 3.0 well enough to exercise the real code
path, including XML parsing. Accounts live in `mock-cas-server/users.json` and
deliberately cover every attribute-release shape:

| Account     | Releases            | Exercises                                  |
| ----------- | ------------------- | ------------------------------------------ |
| `gburdell3` | email + displayName | Full attribute release                     |
| `mchen3`    | displayName only    | Partial release                            |
| `jdoe3`     | _nothing_           | Bare `cas:user` — the GT example's shape   |
| `adminuser` | email + displayName | Admin role                                 |
| `driver1`   | email + displayName | Driver role                                |
| `nodbuser`  | email + displayName | Authenticates at CAS, not provisioned here |

Every password is `password`. Usernames must match the `gtUsername` values in
`scripts/seed.ts`.

## Comparison with the GT reference example

GT publishes a Node.js starter ("CAS Authentication with Node.js apps on
Plesk") built on Express and
[`express-cas-authentication`](https://www.npmjs.com/package/express-cas-authentication).
Reviewed against this app:

### Matches

- **CAS 3.0.** The example sets `cas_version: "3.0"`; we call
  `/p3/serviceValidate`, its CAS 3.0 endpoint.
- **Endpoint.** `https://sso.gatech.edu/cas` is the base URL, so validation
  lands on `https://sso.gatech.edu/cas/p3/serviceValidate`.
- **Username as identity.** The example reads
  `req.session[cas.session_name]` — the username — and nothing else.

### The key finding

The example configures `session_info: "cas_userinfo"`, which is the library's
**opt-in** for storing released attributes (it defaults to `false`). It then
**never reads that object.** Its one protected route greets the user by
username alone.

So GT's own reference integration is username-only in practice, and names no
CAS attribute anywhere in its source. Two consequences:

1. Treating email and display name as optional is not a defensive nicety — it
   matches the only integration GT documents.
2. **We cannot know GT's actual attribute names from the example.** Whether
   real GT CAS releases `email` or `mail`, `displayName` or `givenName`/`sn`,
   depends on how our service is registered. This app parses `cas:email` and
   `cas:displayName` and degrades cleanly when they are absent or differently
   named — but the names are unverified.

> **Open question for whoever registers this service with GT SSO:** which
> attributes are released, and under what names? Until that is answered, treat
> `cas:email` / `cas:displayName` as a guess. Nothing depends on them.

### Intentional deviations

| Area          | GT example                                                                   | Here                            | Why                                                                               |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| `service_url` | Origin only; the library returns you to whatever path you were on            | One fixed callback path         | Simpler for an SPA; one place builds the `service` string                         |
| Logout        | `destroy_session` unset (defaults to `false`), so the local session survives | Cookie cleared, then CAS logout | Leaving a local session alive after logout is a bug                               |
| Sessions      | Server-side store (MySQL)                                                    | Stateless Auth.js JWT cookie    | No session table to run; nothing transfers from the example                       |
| Local dev     | Library's `is_dev_mode` bypass (unused in the example)                       | Mock CAS server                 | A bypass skips XML parsing and ticket validation — the parts most likely to break |
| Config        | CAS URL hardcoded in `app.js`                                                | Environment variables           | Needed for Docker and deploy previews                                             |

### Not transferable

The example's Plesk deployment, Lando setup, MySQL session store, and Pug views
have no counterpart here. Its `.env.example` also defines no CAS variable at
all — the CAS URL is a hardcoded constant — so it offers no guidance on
configuration shape.
