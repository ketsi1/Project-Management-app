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
