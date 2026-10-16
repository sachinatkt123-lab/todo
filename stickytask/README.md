# 🗒️ StickyTask

A full-stack to-do app with sticky-note vibes: natural-language quick add,
a Kanban board with draggable notes, snoozing, and an AI-powered daily digest.

- **Frontend:** React 18 + Vite + Tailwind CSS (no component library) + `react-beautiful-dnd`
- **Backend:** Node.js + Express + PostgreSQL via `node-postgres` (`pg`)
- **AI:** OpenAI or Anthropic behind a single service file (`src/services/aiService.js`),
  with an offline heuristic fallback when no API key is set

## Project layout

```
stickytask/
├── backend/
│   ├── migrations/            # SQL migration files (applied in order)
│   │   ├── 001_create_tasks.sql
│   │   └── 002_tasks_updated_at_trigger.sql
│   ├── src/
│   │   ├── server.js          # Express app entry
│   │   ├── db.js              # pg Pool wrapper
│   │   ├── migrate.js         # tiny forward-only migration runner
│   │   ├── routes/tasks.js    # REST API
│   │   └── services/
│   │       ├── aiService.js   # ← single swap point for the AI provider
│   │       └── providers/     # openai.js / anthropic.js / heuristic.js
│   └── .env.example
└── frontend/
    └── src/
        ├── App.jsx            # list/board toggle, state, actions
        ├── api/client.js      # fetch wrapper for the REST API
        ├── utils.js           # rotation/colors/snooze helpers
        └── components/        # QuickAdd, ListView, BoardView, TaskCard,
                               # TaskFormModal, DigestModal
```

## Getting started

### 1. Database

Create a PostgreSQL database and point `DATABASE_URL` at it:

```bash
createdb stickytask
cd backend
cp .env.example .env   # edit DATABASE_URL if needed
npm install
npm run migrate        # applies migrations/*.sql once each, tracked in _migrations
```

### 2. Backend

```bash
cd backend
npm start              # http://localhost:3001
```

To enable real AI, set one of these in `.env` (otherwise a built-in
heuristic parser/digest is used so everything works offline):

```
AI_PROVIDER=openai        # or "anthropic"
OPENAI_API_KEY=sk-...     # or ANTHROPIC_API_KEY=...
AI_MODEL=gpt-4o-mini      # optional override
```

**Swapping models later is one line**: change `AI_PROVIDER`/`AI_MODEL`, or edit
the `PROVIDERS` registry in `src/services/aiService.js`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxies /tasks → :3001)
```

## REST API

| Method | Path                   | Description |
| ------ | ---------------------- | ----------- |
| POST   | `/tasks`               | Create a task |
| GET    | `/tasks`               | List tasks. Query params: `status`, `priority`, `tag`, `showSnoozed` (default `false` — hides tasks whose `snooze_until` is in the future) |
| GET    | `/tasks/:id`           | Fetch one task |
| PUT    | `/tasks/:id`           | Update any fields |
| DELETE | `/tasks/:id`           | Delete a task |
| PATCH  | `/tasks/:id/status`    | Move between columns (`{"status": "todo"\|"in progress"\|"done"}`) |
| POST   | `/tasks/parse`         | `{"text": "Pay rent friday at 5pm #finance urgent"}` → structured fields |
| POST   | `/tasks/digest`        | Plain-text daily summary: overdue, due today, suggested top 3 |

## Features

- **List view** with a quick-add bar that runs input through the parse endpoint
  and pre-fills the create form.
- **Board view** (Kanban, three status columns). Cards are sticky notes with a
  deterministic random tilt (−2°…+2°) and soft shadow; dragging a card into a
  new column fires `PATCH /tasks/:id/status` (optimistic UI).
- **Snooze:** tap 💤 on a card to hide it for an hour. Snoozed tasks are hidden
  from both views by the API until `snooze_until` passes, then they reappear
  with a short bounce animation (the UI polls every 5s).
- **Daily digest button** opens a modal with the AI-generated plain-text summary.
- Entirely Tailwind, mobile friendly (columns stack on small screens, modals
  dock to the bottom sheet on phones).
