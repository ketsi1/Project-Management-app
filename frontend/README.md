# PM Tool — Frontend

React + TypeScript + Tailwind CSS frontend for the customizable project management tool.

## Run it

```bash
npm install      # first time only: downloads the packages
npm run dev      # starts the app at http://localhost:5173
```

Other commands:

```bash
npm run build    # checks types and builds a production version into /dist
npm run preview  # serves that production build locally
npm run lint     # checks the code for common mistakes
```

## Dual Views Architecture (Boss / PM vs. Employee)

The tool provides two dedicated, tailored perspectives based on role:

1. **Boss / Admin / Project Manager View** (`owner` / `admin`):
   - **Executive Command Center**: High-altitude portfolio health, velocity, and delivery tracking.
   - **Team Capacity & Workload Matrix**: Visual workload distribution across team members (identifies overloaded employees and unassigned tasks).
   - **Portfolio Management**: Create, edit, and delete projects, manage workflow statuses, custom fields, and organization settings.
   - **View Mode Switcher**: Managers can toggle between **Manager View** and **Employee View** in 1 click to preview employee experience or focus on their own assigned tasks.

2. **Employee / Team Member View** (`member`):
   - **Personal Workstation**: Distraction-free personal task queue ("All", "In Progress", "To Do", "In Review", "Done").
   - **Daily Focus Spotlight**: Highlights today's top priority task with 1-click status advancement.
   - **1-Click Quick Progress**: Advance task statuses directly from the card without slow modals.
   - **Safe Permissions**: Destructive actions (deleting/editing projects or altering workflows) are restricted.
   - **Project Collaboration**: Kanban board with a 1-click "⭐ My Tasks Only" filter.

### Quick Demo Accounts

| Name | Role | Email | Password | Dedicated View |
|---|---|---|---|---|
| **Alex Morgan** | `owner` | `alex@acme.com` | `87654321` | **Manager View only** |
| **Sarah Connor** | `member` | `sarah@acme.com` | `12345678` | **Employee View only** (Developer) |
| **David Kim** | `member` | `david@acme.com` | `21345678` | **Employee View only** (Developer) |

*Log in with the email and password. The role decides the view: managers never see the employee view and employees never see the manager view (or settings). Every task belongs to a project.*

## Demo mode vs real backend

With no `.env` file the app uses a built-in **demo backend** (`src/api/mockApi.ts`) that
saves data in your browser. To connect your Express + MySQL backend later:

1. Copy `.env.example` to `.env`
2. Set `VITE_API_URL` (e.g. `http://localhost:4000/api`) and `VITE_SOCKET_URL` (e.g. `http://localhost:4000`)
3. Restart `npm run dev`

The endpoints your Express API must provide are listed in `src/api/httpApi.ts`.
To reset demo data: open the browser console (F12) and run `localStorage.clear()`, then refresh.

## Folder map

```
src/
├─ api/           how the app talks to a backend (mock or real)
├─ context/       shared state: logged-in user, organization configuration
├─ realtime/      Socket.IO connection for live updates
├─ utils/         small helpers (dates, progress, colours)
├─ components/
│  ├─ ui/         buttons, inputs, modal, avatar
│  ├─ layout/     page frames, sidebar, route guards
│  ├─ board/      board, list, task and project forms
│  └─ settings/   statuses, custom fields, terminology, members
├─ pages/         one file per screen
├─ App.tsx        which page shows for which address
├─ main.tsx       starting point
└─ types.ts       shapes of all data
```
