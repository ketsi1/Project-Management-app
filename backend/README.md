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
npm run db:setup              # creates pm_database: schema.sql, demo data, roles, permissions, admin
npm run dev                   # http://localhost:4000/api, restarts on file changes
```

In a second terminal, with the server running:

```bash
npm run smoke                 # end-to-end checks: auth, roles & permissions, CRUD, sockets, logout
```

Seeded logins. All of them appear as one-click buttons on the login page while
`SHOW_DEMO_ACCOUNTS` is on (default outside production):

| Email | Password | Role | Created by |
|---|---|---|---|
| admin@acme.com | Admin@12345 | Admin | `npm run seed:admin` |
| manager@acme.com | Manager@12345 | Project Manager | `npm run seed:users` |
| member@acme.com | Member@12345 | Member | `npm run seed:users` |
| alex@acme.com | 87654321 | Owner | `database/seed.sql` (demo data) |
| sarah@acme.com | 12345678 | Member | `database/seed.sql` (demo data) |
| david@acme.com | 21345678 | Member | `database/seed.sql` (demo data) |

The seeded admin adds everyone else in Settings → Members, either with a password (they can
log in right away) or with an invitation link. Nobody has to sign up. Change the seeded
passwords in `.env` (`SEED_*`) before going live.

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
| `npm run db:seed` / `npm run seed:demo` | Loads or refreshes the Acme Corp demo data. Safe to repeat. |
| `npm run seed` | Runs the four seeders below in order. Safe to repeat. |
| `npm run seed:permissions` | Writes the permission catalog from `src/auth/permissions.js` into `permissions`. |
| `npm run seed:roles` | Gives every organization the default roles (Owner, Admin, Project Manager, Member) with their permissions. Keeps changes admins made. |
| `npm run seed:admin` | Creates the organization `SEED_ORG_NAME` if missing, and its admin account (`SEED_ADMIN_*`). |
| `npm run seed:users` | Creates one account per other role (`SEED_MANAGER_*`, `SEED_MEMBER_*`). |
| `npm run seed:reset` | Same as `seed`, but puts default roles back to their default permissions and resets the seeded accounts' passwords and roles. |
| `npm run smoke` | End-to-end check against a running server (`API_BASE` to override `http://localhost:4000`). Creates a new org each run; doesn't change the demo data. |

**Existing database?** Run `npm run db:migrate` then `npm run seed`. Migration
`004_roles_permissions.sql` moves every member onto a role with the same name, and
`db:migrate` fills in the permissions, so nobody loses access.

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
| `SEED_ORG_NAME` | `Acme Corp` | Organization the seeders put their accounts in |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | `admin@acme.com` / `Admin@12345` / `System Admin` | The admin `seed:admin` creates |
| `SEED_MANAGER_*`, `SEED_MEMBER_*` | see `.env.example` | Accounts `seed:users` creates |
| `SHOW_DEMO_ACCOUNTS` | `true` (dev), `false` (production) | List seeded accounts, with passwords, on the login page |

## Project layout

```
src/
  server.js            HTTP server + Socket.IO, startup DB check, graceful shutdown
  app.js               Express app: helmet, CORS, JSON body, routes, 404, error handler
  config/env.js        Reads and checks environment variables once
  db/pool.js           mysql2 pool, query() and transaction() helpers
  db/mappers.js        Database rows → frontend JSON shapes
  auth/                password.js (bcrypt), tokens.js (JWT), sessionStore.js (revocable sessions),
                       permissions.js (the permission catalog and default roles)
  config/seedAccounts.js  Seeded accounts (from SEED_* variables)
  middleware/          auth.js (authenticate, requirePermission, can), validate.js (zod), errors.js
  validation/          schemas.js — request shapes and user-facing messages
  routes/index.js      Every endpoint, with its auth and role rules
  controllers/         Thin HTTP layer: read request, call service, send status code
  services/            Business rules and SQL, always scoped to the caller's organization
  realtime/            socket.js (token auth, rooms, broadcast), events.js (event names)
scripts/               db-setup, db-migrate, db-seed, smoke-test, seed/ (role, permission and account seeders)
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
- **User ↔ Role ↔ Permission**: each membership points at a role (`organization_members.role_id`),
  and each role has permissions (`role_permissions`). Routes check permissions, never role names:
  `requirePermission('projects.create')`. The list of permissions lives in
  `src/auth/permissions.js`; admins change what each role may do in Settings → Roles
  (`/api/roles`). Permissions are read on every request, so changes apply immediately.
- **Default roles** per organization: Owner (everything, cannot be edited), Admin (everything),
  Project Manager (projects and all tasks, no people or settings), Member (own work, can add
  tasks). Admins can add their own roles.
- **Guard rails**: nobody can give out the owner role, give a role more than their own role
  allows, change their own role, or remove/change the owner. Only the owner can remove or
  change an admin. Built-in roles and roles still in use cannot be deleted.

### Bug tracking

Bugs belong to a project and get a number per organization (`BUG-12`). Status goes
open → in progress → resolved → closed; resolving or closing sets a resolution (fixed, won't fix,
duplicate, cannot reproduce, by design) and reopening clears it. Status, assignee, severity,
priority and project changes are written to the bug's activity log next to its comments.
Permissions: `bugs.report`, `bugs.view_all`, `bugs.manage` (triage). Without `bugs.manage`, the
reporter edits the details and status, and the assignee updates the status.

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
| `bugs:changed` | A bug is reported, changed, commented on or deleted | `{ action, id, projectId }` |

Events only go to the organization's room. Logout disconnects that session's sockets; removing a
member disconnects theirs.

### Errors

Every error is `{ "message": "..." }` with a matching status (400 validation, 401 not logged
in or session ended, 403 wrong role, 404 not found or other organization, 409 duplicate, 429 too
many attempts, 500 unexpected). This is what `httpApi.ts` reads. In development, 500 responses
also include `detail`.

### Invitations

`POST /members` with a `password` creates an account that can log in right away. Without one,
it creates the account with a single-use invitation token (only its SHA-256 is stored).
**No email is sent yet**: the activation link is printed in the server log and, outside
production, returned as `inviteLink` so the admin can copy it from Settings → Members:

```
[invite] ina@acme.com was invited by alex@acme.com. Activation link (valid 72h): http://localhost:5173/accept-invite?token=...
```

The invited person sets their password with `POST /api/auth/accept-invite`
`{ token, password }` (the frontend's `/accept-invite` page), which returns a Session like
login. To send real emails, replace the `console.info` in `src/services/memberService.js`.

## API reference

All paths are under `/api`. Everything except health, register, login and accept-invite needs
`Authorization: Bearer <token>`.

| Method | Path | Permission | Returns |
|---|---|---|---|
| GET | `/health` | public | `{ status: "ok" }` (also checks the database) |
| POST | `/auth/register` | public | `{ pending, message }` (201) |
| POST | `/auth/login` | public | `Session` (with `role`, `roleName`, `permissions`) |
| POST | `/auth/accept-invite` | public | `Session` |
| GET | `/auth/demo-accounts` | public | One-click logins (empty unless `SHOW_DEMO_ACCOUNTS`) |
| POST | `/auth/logout` | any | 204 |
| GET | `/auth/me` | any | `{ user, organizationId, role, roleName, permissions }` |
| GET | `/workspace` | any | `Workspace` (with `roles`; `pendingMembers` needs `members.approve`) |
| PUT | `/organization` | `organization.update` | 204 |
| POST | `/statuses` | `statuses.manage` | `Status` (201) |
| PUT | `/statuses/:id` | `statuses.manage` | `Status` |
| DELETE | `/statuses/:id?moveTo=<statusId>` | `statuses.manage` | 204 |
| POST | `/fields` | `fields.manage` | `CustomField` (201) |
| DELETE | `/fields/:id` | `fields.manage` | 204 (also removes the field's values from tasks) |
| POST | `/members` | `members.create` | `Member` + `inviteLink?` (201). Body `{ fullName, email, roleId, password? }` |
| POST | `/members/:id/approve` | `members.approve` | 204 |
| PUT | `/members/:id/role` | `members.update_role` | `{ id, role, roleId, roleName }` |
| DELETE | `/members/:id` | `members.remove` (`members.approve` for a pending sign-up) | 204 |
| GET | `/permissions` | `roles.manage` | `PermissionInfo[]` |
| GET | `/roles` | `roles.manage` | `RoleDetail[]` |
| POST | `/roles` | `roles.manage` | `RoleDetail` (201). Body `{ name, description, permissions }` |
| PUT | `/roles/:id` | `roles.manage` | `RoleDetail` |
| DELETE | `/roles/:id` | `roles.manage` | 204 |
| GET | `/projects` | any (all with `projects.view_all`, else ones with your tasks) | `Project[]` |
| POST | `/projects` | `projects.create` | `Project` (201) |
| PUT | `/projects/:id` | `projects.update` | `Project` |
| DELETE | `/projects/:id` | `projects.delete` | 204 (deletes its tasks) |
| GET | `/work-items[?projectId=]` | any | `WorkItem[]` |
| POST | `/work-items` | `tasks.create` | `WorkItem` (201) |
| PATCH | `/work-items/:id` | any (others' tasks need `tasks.manage_all`) | `WorkItem` |
| DELETE | `/work-items/:id` | any (others' tasks need `tasks.manage_all`) | 204 |
| GET | `/bugs[?projectId=]` | any (all with `bugs.view_all`, else ones you reported, are assigned, or in your projects) | `Bug[]` |
| GET | `/bugs/:id` | can see it | `Bug` + `comments` (comments and activity log) |
| POST | `/bugs` | `bugs.report` | `Bug` (201), numbered `BUG-<n>` per organization |
| PATCH | `/bugs/:id` | `bugs.manage`, or reporter (details + status), or assignee (status) | `Bug` |
| DELETE | `/bugs/:id` | `bugs.manage`, or the reporter while it is open | 204 |
| POST | `/bugs/:id/comments` | can see it | `BugComment` (201) |
