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
you can instead define `VITE_API_URL` in the site's environment variables and
trigger a new build. Vite embeds `VITE_*` values at build time, so do not put
secrets in them.

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
