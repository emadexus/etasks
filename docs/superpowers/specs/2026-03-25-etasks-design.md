# etasks — Telegram Task Tracker Mini App

## Overview

A minimalistic task tracker that lives inside Telegram. Add the bot to a group chat, and the group gets a shared task board accessible via a Telegram Mini App. The bot handles notifications for new tasks, comments, and approaching deadlines.

## Architecture

**Monorepo: Next.js 14 (App Router)** deployed on Vercel.

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React + Tailwind CSS | Telegram Mini App via `@telegram-apps/sdk` |
| API | Next.js Route Handlers | `/api/telegram/webhook`, `/api/tasks/*`, `/api/comments/*` |
| Database | Neon Postgres | Provisioned via Neon CLI, connected via serverless driver |
| ORM | Drizzle | Type-safe, lightweight, native Neon support |
| Bot | grammY | Webhook mode — Telegram POSTs to `/api/telegram/webhook` |
| Scheduled notifications | Upstash QStash | Via Vercel Marketplace integration |

### Why this stack

- **Single deployment** — one `vercel deploy` for frontend + API + webhook handler.
- **No persistent server** — everything is serverless. Telegram uses webhook mode (pushes to us), so no polling process needed.
- **QStash over cron** — deadline reminders need precise timing (e.g., "1 hour before"). QStash schedules individual HTTP calls at exact times, eliminating the need for polling cron jobs.
- **Neon** — serverless Postgres that scales to zero. Free tier is generous for this use case.

## Data Flow

1. **Bot added to group** → Telegram sends webhook → API creates board, syncs group members
2. **Bot sends welcome message** → "Board created for {group}!" with "Open Task Board" inline button
3. **User opens mini app** → Telegram auth validated via `initData` → user sees their group's task list
4. **Task created** → API writes to Neon → bot posts to group + DMs assignee → schedules QStash reminders
5. **Comment added** → API writes to Neon → bot posts to group + DMs task assignee
6. **Deadline approaching** → QStash fires at scheduled time → API sends reminder via bot to group + assignee DM
7. **Deadline or reminders changed** → cancel existing QStash messages → reschedule new ones

## Database Schema

### boards
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, generated |
| telegram_chat_id | bigint | Unique, the group chat ID |
| name | text | Group name |
| created_at | timestamp | Default now() |

### members
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, generated |
| board_id | uuid | FK → boards |
| telegram_user_id | bigint | Telegram user ID |
| username | text | Telegram username |
| first_name | text | Display name |
| role | text | 'admin' or 'member' |
| joined_at | timestamp | Default now() |
| left_at | timestamp | Nullable. Set when member leaves group, never hard-deleted |

Unique constraint on `(board_id, telegram_user_id)`.

Members are **soft-removed** — when a user leaves the group, `left_at` is set. Their tasks and comments remain intact with valid FKs. They're excluded from assignee pickers and member counts, but historical references (created_by, comments) still resolve. If they rejoin, `left_at` is cleared.

### tasks
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, generated |
| board_id | uuid | FK → boards |
| title | text | Required |
| description | text | Optional |
| status | text | 'todo', 'in_progress', 'done'. Default 'todo' |
| priority | text | 'low', 'medium', 'high'. Default 'medium' |
| assignee_id | uuid | FK → members, nullable |
| created_by | uuid | FK → members |
| deadline | timestamp | Default: created_at + 24 hours |
| created_at | timestamp | Default now() |
| updated_at | timestamp | Default now(), auto-updated |

### comments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, generated |
| task_id | uuid | FK → tasks |
| author_id | uuid | FK → members |
| text | text | Required |
| created_at | timestamp | Default now() |

### task_reminders
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, generated |
| task_id | uuid | FK → tasks |
| offset_label | text | '1h', '6h', '12h', '24h', '48h', '3d', '7d', '30d' |
| remind_at | timestamp | Computed: deadline - offset |
| qstash_message_id | text | For cancellation on deadline change |
| sent | boolean | Default false |

When a task's deadline changes, all unsent reminders for that task are cancelled via QStash API and rescheduled.

Default reminder on task creation: **24h**.

## User Identity & Auth

- Users authenticate via Telegram Mini App `initData` — validated server-side using the bot token.
- No separate auth system. Telegram user ID is the identity.
- `initData` contains the `chat_id` (which group the mini app was opened from), used to resolve which board the user is viewing. API routes derive the board from this.
- Group membership determines board access. Initial member list synced when bot is added to group.
- **Lazy sync (current user only)**: when a user opens the mini app, we check/upsert only *their* member record (via `getChatMember` for that one user). We do NOT re-sync the full member list on every open — that's expensive and permission-sensitive.
- Full member list refresh only happens on explicit bot events (new member joined, member left).

## Authorization

- **Task creation**: any board member.
- **Task editing/deletion**: task creator or board admins (members with `role = 'admin'` — the group admin who added the bot).
- **Comments**: any board member can comment; no deletion in v1.

## DM Delivery

- Telegram requires users to have started a private chat with the bot before it can DM them.
- If a DM fails (user hasn't started the bot), the notification silently falls back to an @mention in the group message.
- The welcome message in the group should encourage members to start the bot for personal notifications.

## UI Design

### Visual Direction: Frosted Dark

- Dark gradient background (`#0f172a` → `#1e293b`)
- Glassmorphism cards: `background: rgba(255,255,255,0.03)`, `border: 1px solid rgba(255,255,255,0.06)`, `backdrop-filter: blur(8px)`
- Rounded corners (12px cards, 8px chips)
- Accent colors: blue (`#3b82f6`) for primary actions, orange (`#f97316`) for high priority, yellow (`#eab308`) for medium, red (`#ef4444`) for urgent/overdue
- Typography: system font stack, tight letter-spacing on headings

### Screen 1: Task List (Main Screen)

- **Header**: board name + member count + filter menu icon
- **Filter chips**: horizontal scroll — All, My tasks, To do, In progress, Done
- **Quick-add**: dashed-border input at top, type title + enter → creates task with defaults (todo, medium, unassigned, 24h deadline)
- **Task cards**: frosted glass cards showing:
  - Checkbox (empty = todo, half-filled = in progress, checked = done)
  - Title
  - Meta row: priority chip, assignee name, relative deadline, comment count
- **Done tasks**: faded (opacity 0.45), strikethrough title, sorted to bottom

### Screen 2: Task Detail (Bottom Sheet)

Triggered by tapping a task card. Slides up from bottom, dimming the list behind.

- **Drag handle** at top
- **Title** (editable)
- **Description** (editable, optional)
- **Meta chips row**: Status, Priority, Assignee, Deadline — each tappable to edit
- **Reminder chips**: 1h, 6h, 12h, 24h, 48h, 3d, 7d, 30d — toggle on/off, highlighted when active
- **Comments section**: thread of comments with author + timestamp, input field at bottom with send button

### Screen 3: Filters Panel

Accessed via menu icon in header. Chip-based multi-select filters:

- **Status**: All / To do / In progress / Done
- **Priority**: All / High / Medium / Low
- **Assignee**: All / {member names}
- **Sort by**: Newest / Deadline / Priority
- **Reset** link and **Apply** button

### Bot Messages

All bot messages in the group chat follow a consistent format:

- **Welcome**: "Board created for {group}! {n} members synced." + "Open Task Board" inline button
- **New task**: "New task\n{title}\n{priority} · @{assignee} · due {date}"
- **Comment**: "{author} commented on {task title}\n\"{comment text}\""
- **Deadline reminder**: "⏰ Deadline reminder\n{task title}\nDue in {time} · @{assignee}"

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/telegram/webhook` | POST | Receives all Telegram updates (bot added to group, commands) |
| `/api/tasks` | GET | List tasks for a board (with filters) |
| `/api/tasks` | POST | Create a task |
| `/api/tasks/[id]` | GET | Get task detail |
| `/api/tasks/[id]` | PATCH | Update task (status, priority, assignee, deadline, title, description) |
| `/api/tasks/[id]` | DELETE | Delete task |
| `/api/comments` | GET | List comments for a task |
| `/api/comments` | POST | Add comment to a task |
| `/api/notify/deadline` | POST | QStash callback — sends deadline reminder |

All routes (except webhook and notify) validate Telegram `initData` from the request header.

The `/api/notify/deadline` route validates the QStash signature to ensure it's a legitimate scheduled call.

## Notification Logic

### Immediate notifications (on API action)
- **Task created** → message to group + DM to assignee (if assigned)
- **Comment added** → message to group + DM to task assignee (if not the commenter)
- **Task assigned/reassigned** → DM to new assignee

### Scheduled notifications (via QStash)

QStash is a **wake-up timer**, not a message sender. It only carries the `task_id` and `reminder_id`. When the callback fires, Vercel looks up the task, checks who to notify, and sends via bot.

- On task creation: schedule QStash calls at `deadline - offset` for each active reminder preset (default: 24h). Payload: `{ task_id, reminder_id }`.
- On deadline change: cancel all pending QStash messages for the task, reschedule with new times.
- On reminder toggle: schedule or cancel the specific QStash message.
- On task completed: cancel all pending reminders.
- **Callback handler** (`/api/notify/deadline`): receives `task_id` + `reminder_id` → loads task from DB → checks it's still active and not done → resolves assignee and group → sends bot messages → marks reminder as `sent`.

## Project Structure

```
etasks/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Mini app entry point
│   │   └── api/
│   │       ├── telegram/
│   │       │   └── webhook/route.ts   # Telegram webhook handler
│   │       ├── tasks/
│   │       │   ├── route.ts           # GET (list), POST (create)
│   │       │   └── [id]/route.ts      # GET, PATCH, DELETE
│   │       ├── comments/
│   │       │   └── route.ts           # GET (list), POST (create)
│   │       └── notify/
│   │           └── deadline/route.ts  # QStash callback
│   ├── components/
│   │   ├── task-list.tsx
│   │   ├── task-card.tsx
│   │   ├── task-detail-sheet.tsx
│   │   ├── quick-add.tsx
│   │   ├── filter-chips.tsx
│   │   ├── filter-panel.tsx
│   │   ├── comment-thread.tsx
│   │   └── reminder-chips.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts             # Drizzle schema
│   │   │   └── index.ts              # Neon connection
│   │   ├── telegram/
│   │   │   ├── bot.ts                # grammY bot instance
│   │   │   ├── auth.ts               # initData validation
│   │   │   └── notify.ts             # Send notification helpers
│   │   └── qstash/
│   │       └── reminders.ts          # Schedule/cancel reminders
│   └── hooks/
│       └── use-telegram.ts            # Telegram Mini App SDK hook
├── drizzle.config.ts
├── tailwind.config.ts
├── next.config.js
├── package.json
└── .env.local
```

## Environment Variables

```
TG_BOT_TOKEN=               # Telegram bot token
DATABASE_URL=                # Neon connection string
QSTASH_TOKEN=                # Upstash QStash token (auto-set via Vercel integration)
QSTASH_CURRENT_SIGNING_KEY=  # For verifying QStash callbacks
QSTASH_NEXT_SIGNING_KEY=     # For key rotation
NEXT_PUBLIC_BOT_USERNAME=    # Bot username for mini app links
```

## Deployment

1. `neonctl` to create database and get connection string
2. `npx drizzle-kit push` to apply schema
3. `vercel deploy` — sets up frontend + API
4. Set Telegram webhook: `POST https://api.telegram.org/bot{token}/setWebhook?url={vercel-url}/api/telegram/webhook`
5. Upstash QStash via Vercel Marketplace — auto-provisions tokens

## Scope Boundaries (v1)

**In scope:**
- One group = one board (flat task list)
- Tasks with title, description, status, priority, assignee, deadline, comments
- Assignees are group members only
- Bot notifications: new task, comment, deadline reminder
- Variable reminder presets: 1h, 6h, 12h, 24h, 48h, 3d, 7d, 30d
- Filter by status, priority, assignee; sort by newest/deadline/priority
- Frosted dark visual theme

**Out of scope (v2+):**
- Multiple boards per group
- Labels/tags
- Multiple assignees
- Subtasks/checklists
- File attachments
- Per-user reminder preferences
- Recurring tasks
- External invites (non-group members)
