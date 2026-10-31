# ConnectHub — End-to-End Test Report

Full Playwright sweep of the frontend against the live backend, on desktop
(1280×800) and mobile (Pixel 5) viewports, plus API-contract tests and a
deployment check against the live Render site.

## How to run

```bash
npm run test:e2e                       # desktop + mobile against a local preview build
npm run test:e2e:live                  # the deployed Render site
npm run test:e2e:report                # open the HTML report

# Admin scenarios (users management, moderation, notifications) need admin
# credentials and are skipped without them:
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
```

---

## Application bugs (fixed)

### 1. A wrong current password signed the user out — critical

`PATCH /users/me` answers **401** when the current password is wrong. The
axios response interceptor treated *every* 401 as an expired session: it
deleted the token and the cached user and did `window.location.href = '/login'`.
Typing a wrong password on the Profile page logged the user out instead of
showing "Current password is incorrect".

*Fix* — `src/api/axios.js` only ends the session when the failed request
actually carried a token, and a request can opt out with
`skipAuthRedirect`. `src/pages/Profile.jsx` opts the password change out,
and signs in / signs up opt out too.

### 2. Raw backend exceptions were shown to users

The error panels rendered the backend's message verbatim, so a throttled
sign-in showed **"ThrottlerException: Too Many Requests"** — an internal
framework string, not something a user can act on.

*Fix* — new `src/api/errors.js` with `toUserMessage()`. It maps 429 and
connection failures to readable text and drops anything that looks like an
exception class name or a stack trace. Used across every page.

### 3. Profile messages were never announced

The name/password result banner rendered a plain `<p>`. Screen readers do not
announce it, and it was invisible to the test suite's `getByRole('alert')`.

*Fix* — `role="alert"` on errors, `role="status"` on success.

### 4. Icon ligature text polluted every accessible name

The Material Symbols icons are `<span>` elements whose *text content* is the
icon name, so the buttons announced themselves as **"send Create Post"** and
**"add New Post"** instead of "Create Post" and "New Post".

*Fix* — `aria-hidden="true"` on all 56 decorative icon spans.

### 5. A stalled request could hang the whole app forever

Axios had no timeout, and the session check replaces the entire UI while it
runs. One slow `GET /users/me` left the user staring at
**"Verifying your session..."** with no timeout, no retry and no way forward.
The backend's real response time is 1.5–5.4 s, and much worse under load.

*Fix* — a 30 s request timeout on the axios instance, and the session check
now retries once on a network error or 5xx before showing the retry panel.

### 6. Marking notifications read could put the unread badge back

Opening the notification panel starts a `GET /notifications/me`. If that
request was still in flight when the user clicked **"Mark all read"**, the
mark-read PATCH completed first and then the stale GET landed and restored
the old unread count — the badge went back to "1 unread" and stayed there.

*Fix* — `src/components/Layout.jsx` keeps a revision counter. Every load and
every local change bumps it, and a load only applies its result if nothing
superseded it.

---

## Backend bugs (fixed in `D:\Connect-Hub-Backend`)

### 6. CORS blocked every request from a local machine

`render.yaml` pinned `CORS_ORIGINS` to `https://connectposthub.netlify.app`
— a dead Netlify domain — and the code default allowed only
`http://localhost:5173`. The browser enforces CORS even for a successful
request, so **every API call from a dev machine was blocked** and the app
looked broken with a network error. Neither `localhost:5173` nor
`localhost:4173` received an `access-control-allow-origin` header.

*Fix* — `src/main.ts` now defaults to the deployed frontend plus the local
dev and preview origins, and `render.yaml` lists the real deployed origin.

### 7. Sign-in was throttled to 5 attempts per minute

`@Throttle({ limit: 5, ttl: 60_000 })` on `POST /auth/login` meant five
sign-ins per minute per IP. Anyone behind a shared NAT, or anyone who mistypes
a password twice, was locked out with a 429.

*Fix* — raised to 20 per minute, still well under the global limit of 120.

---

## Deployment bug (needs a dashboard change)

### 8. The live site 404s on every deep route

```
/          -> 200
/login     -> 404
/posts     -> 404
/signup    -> 404
```

`render.yaml` declares the right SPA rewrite, but the live site was created
from the Render dashboard rather than from the Blueprint, so the rewrite was
never applied. Refreshing on any client-side route returns a plain-text 404.
Render serves a custom `404.html` for static sites, but the site answers with
its built-in plain-text 404, so the fallback has to be the rewrite.

**To fix:** Render → *connect-hub-frontend-1* → Settings → Rewrites →
Add Rewrite — source `/*`, destination `/index.html`, type *Rewrite* — then
redeploy. `e2e/tests/live.spec.js` and `e2e/tests/spa-fallback.spec.js` are
the regression guard for this: against the live site they currently report
**9 failed, 4 passed** — every deep route fails, the root and the asset
checks pass.

---

## Test-suite bugs that were hiding the above

| # | Problem | Fix |
|---|---------|-----|
| 1 | `getByLabel('Password')` matched two elements — the input *and* the "Toggle password visibility" button | exact label matching |
| 2 | The like endpoint answers **201**, the test expected 200 | corrected, and the toggle-off leg added |
| 3 | The unlike test read server state before the toggle request landed | poll the API until it agrees |
| 4 | The "most viewed" test opened *its own* post — a view only counts for another member's post | a second account reads the fixture |
| 5 | The overflow detector flagged decorative blobs that an `overflow: hidden` ancestor already clips | ignore clipped ancestors, assert on the real scrollbar |
| 6 | `addInitScript` re-seeded the garbage token on every navigation, looping the app | seed the token once, then navigate |
| 7 | The mobile and desktop projects renamed the shared account at the same time | mutating tests use a throwaway account |
| 8 | The member list renders as cards *and* a table — both in the DOM | every lookup scoped to the visible layout |
| 9 | The member search is debounced; the test clicked the reset button of a same-named account from a previous run | unique names per run, wait for the list to settle |
| 10 | A role change invalidates that account's own token by design, so the promotion could not be read back with the old token | verify with a fresh sign-in |
| 11 | The tab-bar padding was measured before the app had finished booting | wait for the page to render first |

## Test infrastructure

* **Login throttle** — the throttled sign-in endpoint is now called once per
  run: the session token is cached in memory and on disk
  (`e2e/.cache/`) and shared between workers, and every login retries through
  a 429-aware backoff.
* **CORS** — the backend's origin allowlist excludes localhost, so the test
  browser runs with `--disable-web-security`. This changes the test browser
  only; the application bundle is untouched.
* **Timing** — the test timeout is 180 s and the assertion timeout 30 s,
  because the backend is a free-tier host with 1.5–5.4 s responses.
