# ConnectHub — Frontend

React single-page app for ConnectHub, a community posts platform with JWT authentication, role-based UI, and an analytics dashboard.

**Backend repo:** https://github.com/rithika-b-2005/Connect-Hub-Backend

## Tech Stack

- **React 19** (Vite)
- **Tailwind CSS 4** — Material 3 inspired palette
- **React Router 7**
- **Axios** with JWT interceptor
- **Recharts** for analytics charts

## Features

- Login / Signup / Logout — JWT stored client-side, attached via axios request interceptor, 401 responses auto-logout
- Role-aware UI from one codebase:
  - **User**: create posts, like posts, comment on posts, All Posts / My Posts tabs, personal analytics dashboard
  - **Admin**: hide or restrict any post with a reason, restore moderated posts, manage users (search, role filter, promote/demote, delete), platform-wide analytics dashboard; no Profile page
- Posts feed: client-side search, sort (latest / most liked / most viewed), optimistic like updates, post details with comments and view counts
- Post views count at most once per signed-in user for another user's post; reloading or reopening does not add another view
- Hidden posts are removed from the community feed but remain visible to their author; restricted posts remain visible with likes and comments disabled
- In-app notifications inform authors when their post is hidden, restricted, or restored
- Dashboard: stat cards + bar chart (Recharts), different data per role from one endpoint
- User Profile page: update name, change password (current password verified)
- Responsive: fixed sidebar on desktop, top navigation on mobile

## React hooks used

`useState`, `useEffect`, `useContext` (AuthContext), `useMemo` (feed filtering/sorting), plus a custom `useAuth` hook.

## Setup

```bash
npm install
npm run dev    # http://localhost:5173
```

The API base URL is configured with `VITE_API_URL`. Copy `.env.example` to
`.env.local` for local development and point it at the backend, for example
`http://localhost:3000`. Production builds use `.env.production`; on Netlify,
set `VITE_API_URL` in the site's environment variables to the deployed backend
URL and trigger a new build. Vite embeds `VITE_*` values at build time, so do
not put secrets in them.

## Deployment

Deployed at <https://connect-hub-frontend-1.onrender.com/> as a Render **static
site** (build command `npm ci && npm run build`, publish path `./dist`).

`render.yaml` declares the SPA rewrite rule — every path that does not match a
real file in `dist/` is rewritten to `/index.html`. Without it, refreshing on
`/login`, `/posts`, or any other client-side route returns a 404, because the
static file server has no fallback for `BrowserRouter` deep links.

The build does not rely on that rule. `scripts/spa-fallback.mjs` runs after
`vite build` and writes the fallback into `dist/`:

- `dist/<route>/index.html` for every route in `src/App.jsx`, so a host that
  resolves a directory to its index.html answers with a 200;
- `dist/404.html`, so a host that serves a custom 404 page boots the app
  instead of a plain-text error.

Both files are copies of `dist/index.html`, and the app reads the path with
the History API, so it renders the right view either way.

If the site was created from the Render dashboard rather than a Blueprint, add
the rewrite rule manually as well — it turns the 404 into a 200:
**Static Site → Settings → Rewrites → Add Rewrite**, source `/*`, destination
`/index.html`, type *Rewrite*, then redeploy.

`public/_redirects` carries the equivalent rule for Netlify.

## End-to-end tests

Playwright drives the built app in a real browser against the real backend.

```bash
npm run test:e2e          # desktop + mobile, against a local preview build
npm run test:e2e:live     # the deployed Render site
npm run test:e2e:report   # open the HTML report
```

The suite covers the API contract, sign in / sign up / sign out, the
dashboard, the posts feed (create, search, sort, like, comment, delete,
media), the profile (name, password, avatar), notifications, the responsive
layout at eight viewport widths, and the admin surface (user management,
post moderation).

Two environment variables unlock the admin scenarios — without them those
tests are skipped:

```bash
E2E_ADMIN_EMAIL=admin@connecthub.com E2E_ADMIN_PASSWORD=... npm run test:e2e
```

`E2E_API_URL` and `E2E_LIVE_URL` point the suite at a different deployment.

Two things the suite has to work around, both recorded in `BUG-REPORT.md`:
the backend throttles `POST /auth/login` and only sends
`access-control-allow-origin` for the deployed frontend, so the suite caches
the session token and runs the test browser with `--disable-web-security`.

## Development demo accounts

| Email               | Password | Role |
| ------------------- | -------- | ---- |
| alex@connecthub.com | user123  | user |

The backend creates the admin account with a generated password on first
development startup; check the backend log. Demo accounts are only seeded when
`NODE_ENV=development`.

## Design decisions

- JWT in `localStorage` for simplicity; the trade-off vs httpOnly cookies (XSS exposure) is a known, deliberate choice for this exercise
- Users list search is **server-side** (query params); posts feed search is **client-side** (`useMemo` over loaded data) — demonstrating both patterns
- Role only controls what the UI shows; the API enforces permissions independently
