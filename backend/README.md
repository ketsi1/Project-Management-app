# PM Backend

TypeScript API (Express + Prisma + MySQL + Socket.IO) for the PM frontend in `../frontend`. It implements every
endpoint in `frontend/src/api/httpApi.ts`, returns the JSON shapes in `frontend/src/types.ts`,
and pushes changes to connected browsers in real time.

- **Node.js 22.18+** and **MySQL 8.0+**. Node runs the `.ts` files directly in development (it strips
  the types), and `npm run build` compiles them to plain JavaScript in `dist/` for production.
- **TypeScript** in strict mode everywhere: the app, the seeders, the smoke test and the Prisma config.
  Query results, request bodies (inferred from the zod schemas) and permission names are all typed.
- **Prisma 7** is the ORM: `prisma/schema.prisma` describes every table, Prisma Migrate handles
  database changes, and all queries go through Prisma Client.
- Authentication is built in: bcrypt password hashes, signed JWTs, our own Express middleware and
  role checks. No Passport or third-party auth service.

## Quick start

```bash
cd backend
npm install
cp .env.example .env          # then set DB_USER / DB_PASSWORD (and JWT_SECRET for production)
npm run db:setup              # applies migrations, then seeds roles, permissions, accounts, demo data
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
| alex@acme.com | 87654321 | Owner | `npm run seed:demo` (demo data) |
| sarah@acme.com | 12345678 | Member | `npm run seed:demo` (demo data) |
| david@acme.com | 21345678 | Member | `npm run seed:demo` (demo data) |

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
| `npm run dev` | Start from the TypeScript source with `node --watch` (restarts on changes) |
| `npm run typecheck` | Check every file for type errors without running anything (`tsc --noEmit`) |
| `npm run build` | Compile `src/` to JavaScript in `dist/` |
| `npm start` | Start the compiled build for production (run `npm run build` first) |
| `npm run db:setup` | Fresh database: applies every migration, then seeds roles, permissions, accounts and the demo data. Never drops anything. |
| `npm run db:migrate -- --name what_changed` | **Changing the database:** after editing `prisma/schema.prisma`, creates a migration in `prisma/migrations/` and applies it (development; asks before anything destructive). |
| `npm run db:deploy` | Applies migrations that haven't run yet (production, other machines). Never drops data. |
| `npm run db:status` | Shows which migrations are applied. |
| `npm run db:reset` | **Drops everything**, re-applies all migrations and runs the seeders. Asks first. |
| `npm run db:studio` | Opens Prisma Studio, a browser UI to look at and edit the data. |
| `npm run db:generate` | Regenerates Prisma Client after a schema change (`db:migrate` and `npm install` do this too). |
| `npm run db:seed` / `npm run seed:demo` | Adds the Acme Corp demo data (projects, tasks, bugs). Only adds what is missing; never changes your edits. |
| `npm run seed` | Runs the four seeders below in order. Safe to repeat. |
| `npm run seed:permissions` | Writes the permission catalog from `src/auth/permissions.ts` into `permissions`. |
| `npm run seed:roles` | Gives every organization the default roles (Owner, Admin, Project Manager, Member) with their permissions. Keeps changes admins made. |
| `npm run seed:admin` | Creates the admin account (`SEED_ADMIN_*`) in the organization it already belongs to, or in `SEED_ORG_NAME` (created if missing). |
| `npm run seed:users` | Creates one account per other role (`SEED_MANAGER_*`, `SEED_MEMBER_*`). |
| `npm run seed:reset` | Same as `seed`, but puts default roles back to their default permissions and resets the seeded accounts' passwords and roles. |
| `npm run smoke` | End-to-end check against a running server (`API_BASE` to override `http://localhost:4000`). Creates a new org each run; doesn't change the demo data. |

### Changing the database with Prisma

1. Edit `prisma/schema.prisma` (add a model, a field, an index…).
2. Run `npm run db:migrate -- --name add_due_time` in a terminal. Prisma writes the SQL into
   `prisma/migrations/<timestamp>_add_due_time/`, applies it to your database and regenerates the client.
3. Commit the schema and the new migration folder. Other machines run `npm run db:deploy`.

The first migration, `0_init`, describes the database as it was when Prisma was introduced. It was
marked as already applied on the existing database (a "baseline"), so it never re-runs over your data.

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
| `DATABASE_URL` | built from `DB_*` | Optional. A full `mysql://user:pass@host:3306/db` URL instead of the `DB_*` values |
| `SEED_ORG_NAME` | `Acme Corp` | Organization the seeders put their accounts in |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | `admin@acme.com` / `Admin@12345` / `System Admin` | The admin `seed:admin` creates |
| `SEED_MANAGER_*`, `SEED_MEMBER_*` | see `.env.example` | Accounts `seed:users` creates |
| `SHOW_DEMO_ACCOUNTS` | `true` (dev), `false` (production) | List seeded accounts, with passwords, on the login page |

## Project layout

```
src/
  server.ts            HTTP server + Socket.IO, startup DB check, graceful shutdown
  app.ts               Express app: helmet, CORS, JSON body, routes, 404, error handler
  config/env.ts        Reads and checks environment variables once
  db/prisma.ts         The shared Prisma Client (MySQL through the MariaDB driver adapter), and the Db type
  db/mappers.ts        Prisma records → frontend JSON shapes (and their DTO types)
  generated/prisma/    Generated Prisma Client (not committed; `npm install` creates it)
  auth/                password.ts (bcrypt), tokens.ts (JWT), sessionStore.ts (revocable sessions, AuthContext),
                       permissions.ts (the permission catalog, PermissionKey type and default roles)
  config/seedAccounts.ts  Seeded accounts (from SEED_* variables)
  middleware/          auth.ts (authenticate, authOf, requirePermission, can),
                       validate.ts (validate, validated, param), errors.ts
  validation/          schemas.ts — request shapes, user-facing messages, and input types (z.infer)
  routes/index.ts      Every endpoint, with its auth and role rules
  controllers/         Thin HTTP layer: read request, call service, send status code
  services/            Business rules and SQL, always scoped to the caller's organization
  realtime/            socket.ts (token auth, rooms, broadcast), events.ts (event names)
  types/express.d.ts   Adds req.auth and req.valid to Express's Request type
prisma/
  schema.prisma        Every table, column, index and relation
  migrations/          SQL migrations created by Prisma Migrate
  seed/                Seeders: roles, permissions, accounts (index.ts) and demo data (demo.ts)
prisma.config.ts       Prisma CLI settings (schema, migrations, seed command, connection)
scripts/smoke-test.ts  End-to-end check against a running server
tsconfig.json          Type-checking settings for everything above (strict)
tsconfig.build.json    Build settings: src/ → dist/
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
  `src/auth/permissions.ts`; admins change what each role may do in Settings → Roles
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
login. To send real emails, replace the `console.info` in `src/services/memberService.ts`.

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

## TypeScript conventions

- **Imports use the real file name**, `import { env } from './config/env.ts'`. Node needs that to run
  `.ts` directly, and `npm run build` rewrites them to `.js` in `dist/`.
- **Type-only imports say so**: `import type { Request } from 'express'`. Node removes them when it strips
  types; without `type` it would try to load something that doesn't exist at runtime.
- **No TypeScript-only runtime syntax** (`enum`, `namespace`, constructor parameter properties). Node can't
  strip those, so `erasableSyntaxOnly` reports them. Use `as const` objects instead of enums.
- **Controllers read typed input** with `validated(req, schemas.createBugSchema)` (the same schema the
  route's `validate()` used), the caller with `authOf(req)`, and route ids with `param(req, 'id')`.
- **Functions that may run inside a transaction take `db: Db`** (from `src/db/prisma.ts`), which accepts
  both `prisma` and the `tx` client of `prisma.$transaction(async (tx) => ...)`.
- **Permission names are checked by the compiler**: `requirePermission('projects.creat')` is a type error.
