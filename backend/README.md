# PM Backend

Express + MySQL + Socket.IO API for the PM frontend in `../pm-frontend`. It implements every
endpoint in `pm-frontend/src/api/httpApi.ts`, returns the JSON shapes in `pm-frontend/src/types.ts`,
and pushes `workItems:changed` to connected browsers when tasks change.

- **Node.js 20.12+** (tested on Node 24) and **MySQL 8.0+**
- Authentication is built in: bcrypt password hashes, signed JWTs, our own Express middleware and
  role checks. No Passport or third-party auth service.

## Quick start

```bash
cd backend
npm install
cp .env.example .env          # then set DB_USER / DB_PASSWORD (and JWT_SECRET for production)
npm run db:setup              # creates pm_database from ../database/schema.sql + seed.sql
npm run dev                   # http://localhost:4000/api, restarts on file changes
```

In a second terminal, with the server running:

```bash
npm run smoke                 # 48 end-to-end checks: auth, CRUD, permissions, sockets, logout
```

Seeded logins (from `database/seed.sql`). The role decides the view; there is no way to switch:

| Email | Password | Role | View |
|---|---|---|---|
| alex@acme.com | 87654321 | owner | Manager only |
| sarah@acme.com | 12345678 | member (developer) | Employee only |
| david@acme.com | 21345678 | member (developer) | Employee only |

**Sign-up needs approval.** `POST /auth/register` joins an existing organization (matched by name) as a
`pending` employee and returns no token. Login answers 403 until a manager calls
`POST /members/:id/approve` (the Approve button in Settings → Members). `DELETE /members/:id` rejects.

## Point the frontend at it

Create `pm-frontend/.env` (copy `pm-frontend/.env.example`):

```
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```

Restart `npm run dev` in `pm-frontend` (Vite only reads `.env` at startup). The app then uses
`httpApi.ts` instead of the in-browser mock. If Vite runs on a different port or host, add that
origin to `CORS_ORIGIN`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start with `node --watch` (restarts on changes) |
| `npm start` | Start for production |
| `npm run db:setup` | **Drops and recreates all tables** from `schema.sql`, loads `seed.sql`, marks migrations as applied. For a fresh database. |
| `npm run db:migrate` | Applies new files in `database/migrations/` that haven't run yet (tracked in `schema_migrations`). Never drops data. Use this on an existing database. |
| `npm run db:seed` | Loads or refreshes the Acme Corp demo data. Safe to repeat. |
| `npm run smoke` | End-to-end check against a running server (`API_BASE` to override `http://localhost:4000`). Creates a new org each run; doesn't change the demo data. |

**Already loaded the old `schema.sql` by hand?** Run `npm run db:migrate` (adds the
`auth_sessions` table) and `npm run db:seed` (replaces the placeholder password hashes so the
demo users can log in).

## Environment variables

All have development defaults; see `.env.example`.

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` hides error details and requires `JWT_SECRET` |
| `PORT` | `4000` | HTTP and Socket.IO share this port |
| `CORS_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated browser origins allowed for the API and sockets |
| `TRUST_PROXY` | `false` | `true` behind nginx/a load balancer so rate limiting sees client IPs |
| `AUTH_RATE_LIMIT` | `20` | Failed login/register/accept-invite attempts per IP per 15 minutes |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | |
| `DB_USER` / `DB_PASSWORD` | `root` / empty | |
| `DB_NAME` | `pm_database` | The SQL scripts are rewritten to use this name |
| `DB_POOL_SIZE` | `10` | |
| `JWT_SECRET` | dev-only value | **Required in production**, 32+ random characters |
| `TOKEN_TTL_HOURS` | `168` (7 days) | How long a login lasts |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor |
| `INVITE_TTL_HOURS` | `72` | How long invitation links work |
| `APP_URL` | `http://localhost:5173` | Used to build invitation links |

## Project layout

```
src/
  server.js            HTTP server + Socket.IO, startup DB check, graceful shutdown
  app.js               Express app: helmet, CORS, JSON body, routes, 404, error handler
  config/env.js        Reads and checks environment variables once
  db/pool.js           mysql2 pool, query() and transaction() helpers
  db/mappers.js        Database rows → frontend JSON shapes
  auth/                password.js (bcrypt), tokens.js (JWT), sessionStore.js (revocable sessions)
  middleware/          auth.js (authenticate, requireRole), validate.js (zod), errors.js
  validation/          schemas.js — request shapes and user-facing messages
  routes/index.js      Every endpoint, with its auth and role rules
  controllers/         Thin HTTP layer: read request, call service, send status code
  services/            Business rules and SQL, always scoped to the caller's organization
  realtime/            socket.js (token auth, rooms, broadcast), events.js (event names)
scripts/               db-setup, db-migrate, db-seed, smoke-test
```

## How it works

### Authentication

- **Register** creates the organization, the owner account and the same starter content as the
  mock (4 statuses, a "Getting started" project, 4 sample tasks) in one transaction.
- **Passwords** are hashed with bcrypt. Login gives the same error and takes the same time
  whether the email exists or not.
- **Tokens** are HS256 JWTs whose `jti` is a row in `auth_sessions`. Every request checks the
  signature *and* that the session is still active, and reads the user's role from the database,
  so **logout, role changes and member removal take effect immediately** instead of waiting for
  the token to expire.
- **Roles**: `requireRole('owner', 'admin')` guards workspace settings and project
  create/edit/delete. Any member can read everything in their organization and create, edit and
  delete tasks, matching what the UI allows. Only the owner can remove an admin; nobody can
  remove the owner or invite a second owner.

### Organization scoping

The organization always comes from the token, never from the request. Every query filters on
`organization_id`, and when a task refers to a project, status or assignee, the backend checks
that it belongs to the same organization. Another organization's IDs return 404/400.

### Realtime

The frontend connects with `io(VITE_SOCKET_URL, { auth: { token } })`. The socket middleware
checks the token the same way as HTTP, then joins the socket to `org:<id>`, `user:<id>` and
`session:<id>` rooms.

| Event | Sent when | Payload |
|---|---|---|
| `workItems:changed` | A task is created, updated, deleted, or moved by a status/project/member change | `{ action, id?, projectId? }` |
| `projects:changed` | A project is created, renamed or deleted | `{ action, id }` |
| `workspace:changed` | Organization, statuses, fields or members change | `{ section }` |

Events only go to the organization's room. Logout disconnects that session's sockets; removing a
member disconnects theirs.

### Errors

Every error is `{ "message": "..." }` with a matching status (400 validation, 401 not logged
in or session ended, 403 wrong role, 404 not found or other organization, 409 duplicate, 429 too
many attempts, 500 unexpected). This is what `httpApi.ts` reads. In development, 500 responses
also include `detail`.

### Invitations

`POST /members` creates the account with no password and a single-use invitation token (only
its SHA-256 is stored). **No email is sent yet**: the activation link is printed in the server
log:

```
[invite] ina@acme.com was invited by alex@acme.com. Activation link (valid 72h): http://localhost:5173/accept-invite?token=...
```

The invited person sets their password with `POST /api/auth/accept-invite`
`{ token, password }`, which returns a Session like login. The frontend has no accept-invite
page yet. To send real emails, replace the `console.info` in `src/services/memberService.js`.

## API reference

All paths are under `/api`. Everything except health, register, login and accept-invite needs
`Authorization: Bearer <token>`.

| Method | Path | Role | Returns |
|---|---|---|---|
| GET | `/health` | public | `{ status: "ok" }` (also checks the database) |
| POST | `/auth/register` | public | `Session` (201) |
| POST | `/auth/login` | public | `Session` |
| POST | `/auth/accept-invite` | public | `Session` |
| POST | `/auth/logout` | any | 204 |
| GET | `/auth/me` | any | `{ user, organizationId, role }` |
| GET | `/workspace` | any | `Workspace` |
| PUT | `/organization` | owner/admin | 204 |
| POST | `/statuses` | owner/admin | `Status` (201) |
| PUT | `/statuses/:id` | owner/admin | `Status` |
| DELETE | `/statuses/:id?moveTo=<statusId>` | owner/admin | 204 |
| POST | `/fields` | owner/admin | `CustomField` (201) |
| DELETE | `/fields/:id` | owner/admin | 204 (also removes the field's values from tasks) |
| POST | `/members` | owner/admin | `Member` (201) |
| DELETE | `/members/:id` | owner/admin | 204 |
| GET | `/projects` | any | `Project[]` |
| POST | `/projects` | owner/admin | `Project` (201) |
| PUT | `/projects/:id` | owner/admin | `Project` |
| DELETE | `/projects/:id` | owner/admin | 204 (deletes its tasks) |
| GET | `/work-items[?projectId=]` | any | `WorkItem[]` |
| POST | `/work-items` | any | `WorkItem` (201) |
| PATCH | `/work-items/:id` | any | `WorkItem` |
| DELETE | `/work-items/:id` | any | 204 |
