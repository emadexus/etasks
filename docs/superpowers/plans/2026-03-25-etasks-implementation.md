# etasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Telegram Mini App task tracker with bot notifications and scheduled deadline reminders.

**Architecture:** Next.js 14 App Router monorepo on Vercel. Neon Postgres via Drizzle ORM. grammY bot in webhook mode. Upstash QStash for scheduled deadline reminders. Frosted dark glassmorphism UI.

**Tech Stack:** Next.js 14, React, Tailwind CSS, Drizzle ORM, Neon serverless driver, grammY, @telegram-apps/sdk-react, Upstash QStash, Vercel.

**Spec:** `docs/superpowers/specs/2026-03-25-etasks-design.md`

**Neon org:** `org-orange-paper-82887808` (eu-central-1)
**Vercel team:** `emadexus-6207s-projects`
**Bot token:** in `.env` as `TG_BOT_TOKEN`

---

## File Structure

```
etasks/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout, loads TG SDK
│   │   ├── page.tsx                      # Mini app entry — board view
│   │   ├── globals.css                   # Tailwind + frosted dark theme vars
│   │   └── api/
│   │       ├── telegram/
│   │       │   └── webhook/route.ts      # grammY webhook handler
│   │       ├── tasks/
│   │       │   ├── route.ts              # GET list, POST create
│   │       │   └── [id]/route.ts         # GET detail, PATCH update, DELETE
│   │       ├── comments/
│   │       │   └── route.ts              # GET list, POST create
│   │       └── notify/
│   │           └── deadline/route.ts     # QStash callback
│   ├── components/
│   │   ├── telegram-provider.tsx         # TG SDK init + context
│   │   ├── board-view.tsx                # Main board: list + filters + quick-add
│   │   ├── task-card.tsx                 # Single task row
│   │   ├── task-detail-sheet.tsx         # Bottom sheet for task detail
│   │   ├── quick-add.tsx                 # Inline task creation input
│   │   ├── filter-chips.tsx              # Horizontal filter chip bar
│   │   ├── filter-panel.tsx              # Full filter panel overlay
│   │   ├── comment-thread.tsx            # Comments list + input
│   │   └── reminder-chips.tsx            # Reminder preset toggles
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts                # Drizzle table definitions
│   │   │   ├── index.ts                 # Neon connection + drizzle instance
│   │   │   └── queries.ts               # Reusable query helpers
│   │   ├── telegram/
│   │   │   ├── bot.ts                   # grammY Bot instance
│   │   │   ├── auth.ts                  # initData validation
│   │   │   └── notify.ts               # Notification message builders + senders
│   │   └── qstash/
│   │       └── reminders.ts             # Schedule/cancel QStash reminders
│   └── hooks/
│       └── use-board.ts                  # SWR hooks for tasks, comments, board data
├── drizzle.config.ts
├── tailwind.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
└── .env.local
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `drizzle.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `.env.local`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/emadexus/Documents/Mine/Projects/etasks
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes
```

- [ ] **Step 2: Install dependencies**

```bash
pnpm add drizzle-orm @neondatabase/serverless grammy @upstash/qstash swr
pnpm add -D drizzle-kit
```

- [ ] **Step 3: Install Telegram Mini App SDK**

```bash
pnpm add @telegram-apps/sdk-react
```

- [ ] **Step 4: Create drizzle.config.ts**

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 5: Set up .env.local from existing .env**

Copy `TG_BOT_TOKEN` from `.env`. Add placeholders for the rest (filled in Task 2):

```
TG_BOT_TOKEN=<from .env>
DATABASE_URL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
NEXT_PUBLIC_BOT_USERNAME=
NEXT_PUBLIC_APP_URL=
```

- [ ] **Step 6: Update tailwind.config.ts with scrollbar-hide utility**

Replace the generated `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {},
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".scrollbar-hide": {
          "-ms-overflow-style": "none",
          "scrollbar-width": "none",
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
      });
    }),
  ],
};
export default config;
```

- [ ] **Step 7: Set up globals.css with frosted dark theme**

Replace the default `globals.css` with Tailwind directives and CSS custom properties for the frosted dark theme:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-card: rgba(255, 255, 255, 0.03);
  --border-card: rgba(255, 255, 255, 0.06);
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --text-dim: #475569;
  --accent-blue: #3b82f6;
  --accent-blue-bg: rgba(59, 130, 246, 0.12);
  --accent-orange: #f97316;
  --accent-orange-bg: rgba(249, 115, 22, 0.07);
  --accent-yellow: #eab308;
  --accent-yellow-bg: rgba(234, 179, 8, 0.07);
  --accent-red: #ef4444;
  --accent-red-bg: rgba(239, 68, 68, 0.07);
}

body {
  background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 8: Create minimal layout.tsx and page.tsx**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "etasks",
  description: "Task tracker for Telegram",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--text-muted)]">etasks loading...</p>
    </div>
  );
}
```

- [ ] **Step 9: Verify dev server starts**

```bash
pnpm dev
```

Open http://localhost:3000 — should show "etasks loading..." on dark gradient background.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "scaffold: Next.js project with Tailwind, Drizzle, grammY, QStash deps"
```

---

### Task 2: Neon Database + Vercel Project Setup

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Create Neon project**

```bash
neonctl projects create --name etasks --region-id aws-eu-central-1 --org-id org-orange-paper-82887808 --output json
```

Save the connection string from the output.

- [ ] **Step 2: Get the connection string**

```bash
neonctl connection-string --project-id <project-id> --org-id org-orange-paper-82887808
```

Add to `.env.local` as `DATABASE_URL`.

- [ ] **Step 3: Create Vercel project and link**

```bash
cd /Users/emadexus/Documents/Mine/Projects/etasks
vercel link --yes
```

- [ ] **Step 4: Add Upstash QStash via Vercel Marketplace**

```bash
vercel integration add upstash
```

Follow prompts. This provisions QStash and sets `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` as env vars in Vercel.

- [ ] **Step 5: Pull Vercel env vars to local**

```bash
vercel env pull .env.local
```

This pulls QStash tokens + any other Vercel env vars to `.env.local`.

- [ ] **Step 6: Set remaining env vars in Vercel**

```bash
echo "<bot-token>" | vercel env add TG_BOT_TOKEN production preview development
echo "<neon-connection-string>" | vercel env add DATABASE_URL production preview development
echo "etasks_bot" | vercel env add NEXT_PUBLIC_BOT_USERNAME production preview development
```

Replace `<bot-token>` with value from `.env`, `<neon-connection-string>` from step 2, and the actual bot username.

- [ ] **Step 7: Pull env vars again to get everything locally**

```bash
vercel env pull .env.local
```

- [ ] **Step 8: Commit (no secrets)**

```bash
git add -A
git commit -m "infra: link Vercel project, Neon database, QStash integration"
```

---

### Task 3: Database Schema + Drizzle Setup

**Files:**
- Create: `src/lib/db/schema.ts`, `src/lib/db/index.ts`

- [ ] **Step 1: Create Neon connection module**

`src/lib/db/index.ts`:
```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 2: Create Drizzle schema**

`src/lib/db/schema.ts`:
```typescript
import { pgTable, uuid, text, timestamp, bigint, boolean, unique } from "drizzle-orm/pg-core";

export const boards = pgTable("boards", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramChatId: bigint("telegram_chat_id", { mode: "bigint" }).notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id").notNull().references(() => boards.id),
  telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).notNull(),
  username: text("username"),
  firstName: text("first_name").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
}, (table) => ({
  uniqueMember: unique().on(table.boardId, table.telegramUserId),
}));

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id").notNull().references(() => boards.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["todo", "in_progress", "done"] }).notNull().default("todo"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  assigneeId: uuid("assignee_id").references(() => members.id),
  createdBy: uuid("created_by").notNull().references(() => members.id),
  deadline: timestamp("deadline").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  authorId: uuid("author_id").notNull().references(() => members.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskReminders = pgTable("task_reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  offsetLabel: text("offset_label").notNull(),
  remindAt: timestamp("remind_at").notNull(),
  qstashMessageId: text("qstash_message_id"),
  sent: boolean("sent").notNull().default(false),
});
```

- [ ] **Step 3: Push schema to Neon**

```bash
npx drizzle-kit push
```

Expected: tables `boards`, `members`, `tasks`, `comments`, `task_reminders` created.

- [ ] **Step 4: Verify tables exist**

```bash
neonctl sql --project-id <project-id> --org-id org-orange-paper-82887808 "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
```

Expected: all 5 tables listed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/
git commit -m "feat: Drizzle schema with boards, members, tasks, comments, reminders"
```

---

### Task 4: Telegram Bot + Webhook Handler

**Files:**
- Create: `src/lib/telegram/bot.ts`, `src/lib/telegram/auth.ts`, `src/lib/telegram/notify.ts`, `src/app/api/telegram/webhook/route.ts`

- [ ] **Step 1: Create bot instance**

`src/lib/telegram/bot.ts`:
```typescript
import { Bot } from "grammy";

if (!process.env.TG_BOT_TOKEN) {
  throw new Error("TG_BOT_TOKEN is required");
}

export const bot = new Bot(process.env.TG_BOT_TOKEN);
```

- [ ] **Step 2: Create initData auth validator**

`src/lib/telegram/auth.ts`:
```typescript
import { createHmac } from "crypto";

export function validateInitData(initData: string): { userId: bigint; username: string | null; firstName: string } | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(process.env.TG_BOT_TOKEN!)
    .digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) return null;

  const userStr = params.get("user");
  if (!userStr) return null;

  const user = JSON.parse(userStr);

  // Note: chatId is NOT available in initData (chat_instance is opaque).
  // The actual chatId is passed as a URL query parameter from the web_app URL.
  return {
    userId: BigInt(user.id),
    username: user.username || null,
    firstName: user.first_name,
  };
}

export function getAuthFromRequest(req: Request) {
  const initData = req.headers.get("x-telegram-init-data");
  if (!initData) return null;
  return validateInitData(initData);
}
```

- [ ] **Step 3: Create notification helpers**

`src/lib/telegram/notify.ts`:
```typescript
import { bot } from "./bot";

export async function notifyGroup(chatId: bigint, text: string, replyMarkup?: object) {
  try {
    await bot.api.sendMessage(chatId.toString(), text, {
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  } catch (e) {
    console.error("Failed to send group message:", e);
  }
}

export async function notifyUser(userId: bigint, text: string) {
  try {
    await bot.api.sendMessage(userId.toString(), text, { parse_mode: "HTML" });
  } catch (e) {
    // User hasn't started bot — silent fail, group message has @mention fallback
    console.warn("Failed to DM user:", userId.toString(), e);
  }
}

export function formatNewTask(title: string, priority: string, assigneeUsername: string | null, deadline: Date) {
  const assignee = assigneeUsername ? `@${assigneeUsername}` : "unassigned";
  const due = deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `<b>New task</b>\n${title}\n● ${priority} · ${assignee} · due ${due}`;
}

export function formatComment(authorName: string, taskTitle: string, commentText: string) {
  const preview = commentText.length > 100 ? commentText.slice(0, 100) + "..." : commentText;
  return `<b>${authorName}</b> commented on <b>${taskTitle}</b>\n<i>"${preview}"</i>`;
}

export function formatDeadlineReminder(taskTitle: string, timeLeft: string, assigneeUsername: string | null) {
  const assignee = assigneeUsername ? `@${assigneeUsername}` : "";
  return `⏰ <b>Deadline reminder</b>\n${taskTitle}\nDue in ${timeLeft} ${assignee}`;
}
```

- [ ] **Step 4: Create webhook route handler**

`src/app/api/telegram/webhook/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import { bot } from "@/lib/telegram/bot";
import { db } from "@/lib/db";
import { boards, members } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyGroup } from "@/lib/telegram/notify";

// Handle bot being added to a group
bot.on("my_chat_member", async (ctx) => {
  const chat = ctx.chat;
  const newStatus = ctx.myChatMember.new_chat_member.status;

  if (chat.type !== "group" && chat.type !== "supergroup") return;

  if (newStatus === "member" || newStatus === "administrator") {
    // Bot was added to group — create board
    const existing = await db.select().from(boards)
      .where(eq(boards.telegramChatId, BigInt(chat.id)))
      .limit(1);

    let boardId: string;
    if (existing.length > 0) {
      boardId = existing[0].id;
    } else {
      const [newBoard] = await db.insert(boards).values({
        telegramChatId: BigInt(chat.id),
        name: chat.title || "Untitled Board",
      }).returning();
      boardId = newBoard.id;
    }

    // Sync members
    try {
      const admins = await bot.api.getChatAdministrators(chat.id);
      for (const admin of admins) {
        if (admin.user.is_bot) continue;
        await db.insert(members).values({
          boardId,
          telegramUserId: BigInt(admin.user.id),
          username: admin.user.username || null,
          firstName: admin.user.first_name,
          role: admin.status === "creator" ? "admin" : "member",
        }).onConflictDoNothing();
      }
    } catch (e) {
      console.error("Failed to sync members:", e);
    }

    // Send welcome message
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME;
    await notifyGroup(BigInt(chat.id),
      `Board created for <b>${chat.title}</b> ✨\nStart the bot privately for personal notifications.`,
      {
        inline_keyboard: [[
          { text: "Open Task Board", web_app: { url: `${appUrl}?chatId=${chat.id}` } }
        ]]
      }
    );
  }

  if (newStatus === "left" || newStatus === "kicked") {
    // Bot removed — we keep the data, just stop interacting
    console.log("Bot removed from chat:", chat.id);
  }
});

// Handle new members joining
bot.on("chat_member", async (ctx) => {
  const chat = ctx.chat;
  const member = ctx.chatMember.new_chat_member;

  if (member.user.is_bot) return;

  const board = await db.select().from(boards)
    .where(eq(boards.telegramChatId, BigInt(chat.id)))
    .limit(1);

  if (board.length === 0) return;

  if (member.status === "member" || member.status === "administrator") {
    await db.insert(members).values({
      boardId: board[0].id,
      telegramUserId: BigInt(member.user.id),
      username: member.user.username || null,
      firstName: member.user.first_name,
      role: "member",
    }).onConflictDoNothing();
  }

  if (member.status === "left" || member.status === "kicked") {
    // Soft-remove
    const existing = await db.select().from(members)
      .where(eq(members.telegramUserId, BigInt(member.user.id)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(members)
        .set({ leftAt: new Date() })
        .where(eq(members.id, existing[0].id));
    }
  }
});

const handler = webhookCallback(bot, "std/http");

export async function POST(req: Request) {
  try {
    return await handler(req);
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json({ ok: true });
  }
}
```

- [ ] **Step 5: Verify build**

```bash
pnpm build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/telegram/ src/app/api/telegram/
git commit -m "feat: Telegram bot with webhook handler, auth, notifications"
```

---

### Task 5: Query Helpers + Tasks API

**Files:**
- Create: `src/lib/db/queries.ts`, `src/app/api/tasks/route.ts`, `src/app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Create query helpers**

`src/lib/db/queries.ts`:
```typescript
import { db } from ".";
import { boards, members, tasks, comments, taskReminders } from "./schema";
import { eq, and, isNull, desc, asc } from "drizzle-orm";

export async function getBoardByChatId(chatId: bigint) {
  const result = await db.select().from(boards)
    .where(eq(boards.telegramChatId, chatId))
    .limit(1);
  return result[0] || null;
}

export async function getMemberByTelegramId(boardId: string, telegramUserId: bigint) {
  const result = await db.select().from(members)
    .where(and(
      eq(members.boardId, boardId),
      eq(members.telegramUserId, telegramUserId),
      isNull(members.leftAt),
    ))
    .limit(1);
  return result[0] || null;
}

export async function upsertMember(boardId: string, telegramUserId: bigint, username: string | null, firstName: string) {
  const existing = await db.select().from(members)
    .where(and(
      eq(members.boardId, boardId),
      eq(members.telegramUserId, telegramUserId),
    ))
    .limit(1);

  if (existing.length > 0) {
    // Re-activate if left, update profile
    await db.update(members)
      .set({ username, firstName, leftAt: null })
      .where(eq(members.id, existing[0].id));
    return existing[0];
  }

  const [member] = await db.insert(members).values({
    boardId,
    telegramUserId,
    username,
    firstName,
  }).returning();
  return member;
}

export async function getActiveMembers(boardId: string) {
  return db.select().from(members)
    .where(and(
      eq(members.boardId, boardId),
      isNull(members.leftAt),
    ));
}

export async function getTasksForBoard(boardId: string, filters?: {
  status?: string;
  priority?: string;
  assigneeId?: string;
  sortBy?: string;
}) {
  let query = db.select({
    task: tasks,
    assignee: members,
  })
    .from(tasks)
    .leftJoin(members, eq(tasks.assigneeId, members.id))
    .where(eq(tasks.boardId, boardId))
    .$dynamic();

  // Filters applied at call site via additional where clauses
  return query.orderBy(desc(tasks.createdAt));
}

export async function getTaskWithDetails(taskId: string) {
  const result = await db.select({
    task: tasks,
    assignee: members,
  })
    .from(tasks)
    .leftJoin(members, eq(tasks.assigneeId, members.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return result[0] || null;
}

export async function getCommentsForTask(taskId: string) {
  return db.select({
    comment: comments,
    author: members,
  })
    .from(comments)
    .innerJoin(members, eq(comments.authorId, members.id))
    .where(eq(comments.taskId, taskId))
    .orderBy(asc(comments.createdAt));
}

export async function getRemindersForTask(taskId: string) {
  return db.select().from(taskReminders)
    .where(eq(taskReminders.taskId, taskId));
}
```

- [ ] **Step 2: Create tasks list + create route**

`src/app/api/tasks/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/telegram/auth";
import { getBoardByChatId, getMemberByTelegramId, upsertMember } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { tasks, members, comments, taskReminders } from "@/lib/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { notifyGroup, notifyUser, formatNewTask } from "@/lib/telegram/notify";
import { scheduleReminders } from "@/lib/qstash/reminders";

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  const board = await getBoardByChatId(BigInt(chatId));
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const member = await getMemberByTelegramId(board.id, auth.userId);
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  // Filters
  const status = req.nextUrl.searchParams.get("status");
  const priority = req.nextUrl.searchParams.get("priority");
  const assigneeId = req.nextUrl.searchParams.get("assigneeId");
  const sortBy = req.nextUrl.searchParams.get("sortBy") || "newest";

  const conditions = [eq(tasks.boardId, board.id)];
  if (status) conditions.push(eq(tasks.status, status as any));
  if (priority) conditions.push(eq(tasks.priority, priority as any));
  if (assigneeId) conditions.push(eq(tasks.assigneeId, assigneeId));

  const orderBy = sortBy === "deadline" ? asc(tasks.deadline)
    : sortBy === "priority" ? desc(tasks.priority)
    : desc(tasks.createdAt);

  const result = await db.select({
    task: tasks,
    assignee: {
      id: members.id,
      username: members.username,
      firstName: members.firstName,
      telegramUserId: members.telegramUserId,
    },
    commentCount: sql<number>`(SELECT count(*) FROM comments WHERE comments.task_id = ${tasks.id})`.as("comment_count"),
  })
    .from(tasks)
    .leftJoin(members, eq(tasks.assigneeId, members.id))
    .where(and(...conditions))
    .orderBy(orderBy);

  return NextResponse.json({ tasks: result, board: { id: board.id, name: board.name } });
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { chatId, title, description, priority, assigneeId, deadline } = body;

  if (!chatId || !title) {
    return NextResponse.json({ error: "chatId and title required" }, { status: 400 });
  }

  const board = await getBoardByChatId(BigInt(chatId));
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  // Lazy sync: upsert current user
  const member = await upsertMember(board.id, auth.userId, auth.username, auth.firstName);

  const deadlineDate = deadline ? new Date(deadline) : new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [task] = await db.insert(tasks).values({
    boardId: board.id,
    title,
    description: description || null,
    priority: priority || "medium",
    assigneeId: assigneeId || null,
    createdBy: member.id,
    deadline: deadlineDate,
  }).returning();

  // Schedule default reminder (24h before deadline)
  await scheduleReminders(task.id, deadlineDate, ["24h"]);

  // Notify group
  let assigneeUsername: string | null = null;
  if (assigneeId) {
    const assignee = await db.select().from(members).where(eq(members.id, assigneeId)).limit(1);
    if (assignee[0]) {
      assigneeUsername = assignee[0].username;
      // DM assignee
      await notifyUser(assignee[0].telegramUserId, formatNewTask(title, priority || "medium", assigneeUsername, deadlineDate));
    }
  }

  await notifyGroup(
    board.telegramChatId,
    formatNewTask(title, priority || "medium", assigneeUsername, deadlineDate)
  );

  return NextResponse.json(task, { status: 201 });
}
```

- [ ] **Step 3: Create task detail/update/delete route**

`src/app/api/tasks/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { tasks, members, taskReminders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTaskWithDetails, getMemberByTelegramId, getBoardByChatId, getRemindersForTask } from "@/lib/db/queries";
import { cancelReminders, scheduleReminders } from "@/lib/qstash/reminders";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getTaskWithDetails(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reminders = await getRemindersForTask(id);

  return NextResponse.json({ ...result, reminders });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getTaskWithDetails(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auth check: creator or admin
  const task = result.task;
  const member = await getMemberByTelegramId(task.boardId, auth.userId);
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const isCreator = task.createdBy === member.id;
  const isAdmin = member.role === "admin";
  if (!isCreator && !isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, any> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId;
  if (body.deadline !== undefined) updates.deadline = new Date(body.deadline);
  updates.updatedAt = new Date();

  const [updated] = await db.update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning();

  // If deadline changed, reschedule reminders
  if (body.deadline) {
    await cancelReminders(id);
    const existingReminders = await getRemindersForTask(id);
    const activeOffsets = existingReminders
      .filter(r => !r.sent)
      .map(r => r.offsetLabel);
    if (activeOffsets.length > 0) {
      await scheduleReminders(id, new Date(body.deadline), activeOffsets);
    }
  }

  // If status changed to done, cancel all reminders
  if (body.status === "done") {
    await cancelReminders(id);
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getTaskWithDetails(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const member = await getMemberByTelegramId(result.task.boardId, auth.userId);
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const isCreator = result.task.createdBy === member.id;
  const isAdmin = member.role === "admin";
  if (!isCreator && !isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Cancel reminders
  await cancelReminders(id);

  // Delete reminders, comments, then task
  await db.delete(taskReminders).where(eq(taskReminders.taskId, id));
  const { comments: commentsTable } = await import("@/lib/db/schema");
  await db.delete(commentsTable).where(eq(commentsTable.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/queries.ts src/app/api/tasks/
git commit -m "feat: tasks API — list, create, update, delete with auth and notifications"
```

---

### Task 6: Comments API

**Files:**
- Create: `src/app/api/comments/route.ts`

- [ ] **Step 1: Create comments route**

`src/app/api/comments/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { comments, tasks, members, boards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCommentsForTask, getMemberByTelegramId, getTaskWithDetails } from "@/lib/db/queries";
import { notifyGroup, notifyUser, formatComment } from "@/lib/telegram/notify";

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const result = await getCommentsForTask(taskId);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { taskId, text } = body;

  if (!taskId || !text) {
    return NextResponse.json({ error: "taskId and text required" }, { status: 400 });
  }

  // Get task + board
  const taskResult = await getTaskWithDetails(taskId);
  if (!taskResult) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const member = await getMemberByTelegramId(taskResult.task.boardId, auth.userId);
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const [comment] = await db.insert(comments).values({
    taskId,
    authorId: member.id,
    text,
  }).returning();

  // Get board for group notification
  const board = await db.select().from(boards)
    .where(eq(boards.id, taskResult.task.boardId))
    .limit(1);

  if (board[0]) {
    const message = formatComment(member.firstName, taskResult.task.title, text);
    await notifyGroup(board[0].telegramChatId, message);

    // DM assignee if not the commenter
    if (taskResult.assignee && taskResult.assignee.id !== member.id) {
      await notifyUser(
        (taskResult.assignee as any).telegramUserId,
        message
      );
    }
  }

  return NextResponse.json(comment, { status: 201 });
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/comments/
git commit -m "feat: comments API — list and create with group + DM notifications"
```

---

### Task 7: QStash Reminders

**Files:**
- Create: `src/lib/qstash/reminders.ts`, `src/app/api/notify/deadline/route.ts`

- [ ] **Step 1: Create reminder scheduling helpers**

`src/lib/qstash/reminders.ts`:
```typescript
import { Client } from "@upstash/qstash";
import { db } from "@/lib/db";
import { taskReminders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

const OFFSET_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export async function scheduleReminders(taskId: string, deadline: Date, offsets: string[]) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  for (const offset of offsets) {
    const ms = OFFSET_MS[offset];
    if (!ms) continue;

    const remindAt = new Date(deadline.getTime() - ms);

    // Don't schedule if already in the past
    if (remindAt.getTime() <= Date.now()) continue;

    // Insert reminder row
    const [reminder] = await db.insert(taskReminders).values({
      taskId,
      offsetLabel: offset,
      remindAt,
    }).returning();

    // Schedule QStash
    try {
      const result = await qstash.publishJSON({
        url: `${appUrl}/api/notify/deadline`,
        body: { taskId, reminderId: reminder.id },
        notBefore: Math.floor(remindAt.getTime() / 1000),
      });

      // Save QStash message ID for cancellation
      await db.update(taskReminders)
        .set({ qstashMessageId: result.messageId })
        .where(eq(taskReminders.id, reminder.id));
    } catch (e) {
      console.error("Failed to schedule QStash reminder:", e);
    }
  }
}

export async function cancelReminders(taskId: string) {
  const reminders = await db.select().from(taskReminders)
    .where(and(
      eq(taskReminders.taskId, taskId),
      eq(taskReminders.sent, false),
    ));

  for (const reminder of reminders) {
    if (reminder.qstashMessageId) {
      try {
        await qstash.messages.delete(reminder.qstashMessageId);
      } catch (e) {
        console.warn("Failed to cancel QStash message:", reminder.qstashMessageId, e);
      }
    }
  }

  // Delete unsent reminders from DB
  await db.delete(taskReminders)
    .where(and(
      eq(taskReminders.taskId, taskId),
      eq(taskReminders.sent, false),
    ));
}

export async function toggleReminder(taskId: string, offset: string, deadline: Date, enable: boolean) {
  if (enable) {
    await scheduleReminders(taskId, deadline, [offset]);
  } else {
    const reminders = await db.select().from(taskReminders)
      .where(and(
        eq(taskReminders.taskId, taskId),
        eq(taskReminders.sent, false),
      ));

    const target = reminders.find(r => r.offsetLabel === offset);
    if (target?.qstashMessageId) {
      try {
        await qstash.messages.delete(target.qstashMessageId);
      } catch (e) {
        console.warn("Failed to cancel reminder:", e);
      }
    }
    if (target) {
      await db.delete(taskReminders).where(eq(taskReminders.id, target.id));
    }
  }
}
```

- [ ] **Step 2: Create deadline notification callback route**

`src/app/api/notify/deadline/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { db } from "@/lib/db";
import { tasks, members, boards, taskReminders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyGroup, notifyUser, formatDeadlineReminder } from "@/lib/telegram/notify";

async function handler(req: NextRequest) {
  const body = await req.json();
  const { taskId, reminderId } = body;

  if (!taskId || !reminderId) {
    return NextResponse.json({ error: "Missing taskId or reminderId" }, { status: 400 });
  }

  // Load task
  const taskResult = await db.select({
    task: tasks,
    assignee: members,
    board: boards,
  })
    .from(tasks)
    .innerJoin(boards, eq(tasks.boardId, boards.id))
    .leftJoin(members, eq(tasks.assigneeId, members.id))
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (taskResult.length === 0) {
    return NextResponse.json({ ok: true, skipped: "task not found" });
  }

  const { task, assignee, board } = taskResult[0];

  // Skip if already done
  if (task.status === "done") {
    return NextResponse.json({ ok: true, skipped: "task done" });
  }

  // Mark reminder as sent
  await db.update(taskReminders)
    .set({ sent: true })
    .where(eq(taskReminders.id, reminderId));

  // Calculate time left
  const msLeft = task.deadline.getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.round(msLeft / (60 * 60 * 1000)));
  const timeLeft = hoursLeft >= 24
    ? `${Math.round(hoursLeft / 24)}d`
    : `${hoursLeft}h`;

  const message = formatDeadlineReminder(
    task.title,
    timeLeft,
    assignee?.username || null,
  );

  // Notify group
  await notifyGroup(board.telegramChatId, message);

  // DM assignee
  if (assignee) {
    await notifyUser(assignee.telegramUserId, message);
  }

  return NextResponse.json({ ok: true });
}

export const POST = verifySignatureAppRouter(handler);
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/qstash/ src/app/api/notify/
git commit -m "feat: QStash reminder scheduling + deadline notification callback"
```

---

### Task 8: Reminder Toggle API Endpoint

**Files:**
- Modify: `src/app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Add reminder toggle to task PATCH**

Add handling for `reminders` field in the PATCH body of `src/app/api/tasks/[id]/route.ts`. After the existing deadline/status logic, add:

```typescript
// Handle reminder toggles: { reminders: { "1h": true, "7d": false } }
if (body.reminders) {
  const taskDeadline = body.deadline ? new Date(body.deadline) : result.task.deadline;
  for (const [offset, enabled] of Object.entries(body.reminders)) {
    await toggleReminder(id, offset, taskDeadline, enabled as boolean);
  }
}
```

Add `toggleReminder` to the import from `@/lib/qstash/reminders`.

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tasks/
git commit -m "feat: reminder toggle via task PATCH endpoint"
```

---

### Task 9: Board Members API

**Files:**
- Create: `src/app/api/members/route.ts`

- [ ] **Step 1: Create members route**

`src/app/api/members/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/telegram/auth";
import { getBoardByChatId, getActiveMembers, upsertMember } from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  const board = await getBoardByChatId(BigInt(chatId));
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  // Lazy sync current user
  await upsertMember(board.id, auth.userId, auth.username, auth.firstName);

  const membersList = await getActiveMembers(board.id);
  return NextResponse.json(membersList);
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/members/
git commit -m "feat: members API — list active members with lazy sync"
```

---

### Task 10: Telegram Provider + Hooks

**Files:**
- Create: `src/components/telegram-provider.tsx`, `src/hooks/use-board.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create Telegram provider component**

`src/components/telegram-provider.tsx`:
```tsx
"use client";

import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { init, retrieveLaunchParams } from "@telegram-apps/sdk-react";

interface TelegramContext {
  initData: string | null;
  chatId: string | null;
  userId: string | null;
  ready: boolean;
}

const TgContext = createContext<TelegramContext>({
  initData: null,
  chatId: null,
  userId: null,
  ready: false,
});

export function useTelegram() {
  return useContext(TgContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<TelegramContext>({
    initData: null,
    chatId: null,
    userId: null,
    ready: false,
  });

  useEffect(() => {
    try {
      init();
      const lp = retrieveLaunchParams();
      const initDataRaw = lp.initDataRaw || null;
      const chatId = lp.startParam || new URLSearchParams(window.location.search).get("chatId");
      const userId = lp.initData?.user?.id?.toString() || null;

      setCtx({
        initData: initDataRaw,
        chatId,
        userId,
        ready: true,
      });
    } catch (e) {
      // Dev fallback — not inside Telegram
      console.warn("Not in Telegram Mini App context:", e);
      const chatId = new URLSearchParams(window.location.search).get("chatId");
      setCtx({
        initData: null,
        chatId,
        userId: null,
        ready: true,
      });
    }
  }, []);

  return <TgContext.Provider value={ctx}>{children}</TgContext.Provider>;
}
```

- [ ] **Step 2: Create SWR-based data hooks**

`src/hooks/use-board.ts`:
```tsx
"use client";

import useSWR, { mutate } from "swr";
import { useTelegram } from "@/components/telegram-provider";

function useAuthFetcher() {
  const { initData } = useTelegram();

  return async (url: string) => {
    const res = await fetch(url, {
      headers: initData ? { "x-telegram-init-data": initData } : {},
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  };
}

function useAuthMutate() {
  const { initData } = useTelegram();

  return async (url: string, method: string, body?: object) => {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(initData ? { "x-telegram-init-data": initData } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  };
}

export function useMembers(chatId: string | null) {
  const fetcher = useAuthFetcher();
  return useSWR(chatId ? `/api/members?chatId=${chatId}` : null, fetcher);
}

export function useTasks(chatId: string | null, filters?: Record<string, string>) {
  const fetcher = useAuthFetcher();
  const params = new URLSearchParams({ chatId: chatId || "", ...filters });
  return useSWR(chatId ? `/api/tasks?${params}` : null, fetcher);
}

export function useTaskDetail(taskId: string | null) {
  const fetcher = useAuthFetcher();
  return useSWR(taskId ? `/api/tasks/${taskId}` : null, fetcher);
}

export function useComments(taskId: string | null) {
  const fetcher = useAuthFetcher();
  return useSWR(taskId ? `/api/comments?taskId=${taskId}` : null, fetcher);
}

export function useTaskActions(chatId: string | null) {
  const api = useAuthMutate();

  return {
    createTask: async (data: { title: string; description?: string; priority?: string; assigneeId?: string; deadline?: string }) => {
      const result = await api("/api/tasks", "POST", { ...data, chatId });
      mutate((key: string) => typeof key === "string" && key.startsWith("/api/tasks"), undefined, { revalidate: true });
      return result;
    },
    updateTask: async (id: string, data: object) => {
      const result = await api(`/api/tasks/${id}`, "PATCH", data);
      mutate((key: string) => typeof key === "string" && key.startsWith("/api/tasks"), undefined, { revalidate: true });
      return result;
    },
    deleteTask: async (id: string) => {
      await api(`/api/tasks/${id}`, "DELETE");
      mutate((key: string) => typeof key === "string" && key.startsWith("/api/tasks"), undefined, { revalidate: true });
    },
    addComment: async (taskId: string, text: string) => {
      const result = await api("/api/comments", "POST", { taskId, text });
      mutate((key: string) => typeof key === "string" && key.startsWith("/api/comments"), undefined, { revalidate: true });
      return result;
    },
  };
}
```

- [ ] **Step 3: Update layout.tsx to wrap with provider**

`src/app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from "next";
import { TelegramProvider } from "@/components/telegram-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "etasks",
  description: "Task tracker for Telegram",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/telegram-provider.tsx src/hooks/use-board.ts src/app/layout.tsx
git commit -m "feat: Telegram SDK provider + SWR data hooks"
```

---

### Task 11: Task Card Component

**Files:**
- Create: `src/components/task-card.tsx`

- [ ] **Step 1: Create task card component**

`src/components/task-card.tsx`:
```tsx
"use client";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    deadline: string;
    assigneeId: string | null;
  };
  assignee: {
    firstName: string;
    username: string | null;
  } | null;
  commentCount: number;
  onTap: (id: string) => void;
  onToggleStatus: (id: string, newStatus: string) => void;
}

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "high", color: "var(--accent-orange)", bg: "var(--accent-orange-bg)" },
  medium: { label: "med", color: "var(--accent-yellow)", bg: "var(--accent-yellow-bg)" },
  low: { label: "low", color: "var(--text-dim)", bg: "rgba(255,255,255,0.04)" },
};

function relativeDeadline(deadline: string): { text: string; urgent: boolean } {
  const ms = new Date(deadline).getTime() - Date.now();
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 0) return { text: "overdue", urgent: true };
  if (hours < 1) return { text: "<1h", urgent: true };
  if (hours < 24) return { text: `${hours}h`, urgent: hours <= 2 };
  const days = Math.round(hours / 24);
  return { text: `${days}d`, urgent: false };
}

export function TaskCard({ task, assignee, commentCount, onTap, onToggleStatus }: TaskCardProps) {
  const isDone = task.status === "done";
  const isInProgress = task.status === "in_progress";
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const deadline = relativeDeadline(task.deadline);

  return (
    <div
      className={`rounded-xl border p-3 transition-all active:scale-[0.98] ${
        isDone ? "opacity-45" : ""
      }`}
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-card)",
      }}
      onClick={() => onTap(task.id)}
    >
      <div className="flex items-start gap-2.5">
        {/* Status checkbox */}
        <button
          className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px]"
          style={{
            border: isDone ? "none" : `1.5px solid ${isInProgress ? "var(--accent-blue)" : "var(--text-dim)"}`,
            background: isDone ? "var(--text-dim)" : "transparent",
          }}
          onClick={(e) => {
            e.stopPropagation();
            const next = isDone ? "todo" : task.status === "todo" ? "in_progress" : "done";
            onToggleStatus(task.id, next);
          }}
        >
          {isInProgress && (
            <div className="h-2 w-2 rounded-sm" style={{ background: "var(--accent-blue)" }} />
          )}
          {isDone && (
            <span className="text-[10px]" style={{ color: "var(--bg-secondary)" }}>&#10003;</span>
          )}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-medium ${isDone ? "line-through" : ""}`}
            style={{ color: isDone ? "var(--text-dim)" : "var(--text-primary)" }}>
            {task.title}
          </div>

          {!isDone && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className="rounded px-1.5 py-px text-[10px]"
                style={{ color: priority.color, background: priority.bg }}
              >
                {priority.label}
              </span>
              {assignee && (
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {assignee.firstName.toLowerCase()}
                </span>
              )}
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>&middot;</span>
              <span
                className="text-[10px]"
                style={{ color: deadline.urgent ? "var(--accent-red)" : "var(--text-muted)" }}
              >
                {deadline.text}
              </span>
              {commentCount > 0 && (
                <>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>&middot;</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {commentCount} 💬
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/task-card.tsx
git commit -m "feat: TaskCard component with status toggle, priority, deadline"
```

---

### Task 12: Quick Add Component

**Files:**
- Create: `src/components/quick-add.tsx`

- [ ] **Step 1: Create quick add input**

`src/components/quick-add.tsx`:
```tsx
"use client";

import { useState, useRef } from "react";

interface QuickAddProps {
  onAdd: (title: string) => Promise<void>;
}

export function QuickAdd({ onAdd }: QuickAddProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const title = value.trim();
    if (!title || loading) return;
    setLoading(true);
    try {
      await onAdd(title);
      setValue("");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="flex items-center gap-2 rounded-[10px] border border-dashed px-3.5 py-2.5"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
    >
      <span style={{ color: "var(--text-muted)" }}>+</span>
      <input
        ref={inputRef}
        className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]"
        placeholder="Add task..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        disabled={loading}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/quick-add.tsx
git commit -m "feat: QuickAdd inline task creation component"
```

---

### Task 13: Filter Chips + Filter Panel

**Files:**
- Create: `src/components/filter-chips.tsx`, `src/components/filter-panel.tsx`

- [ ] **Step 1: Create filter chips bar**

`src/components/filter-chips.tsx`:
```tsx
"use client";

interface FilterChipsProps {
  active: string;
  onChange: (filter: string) => void;
}

const filters = [
  { key: "all", label: "All" },
  { key: "my", label: "My tasks" },
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export function FilterChips({ active, onChange }: FilterChipsProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {filters.map((f) => (
        <button
          key={f.key}
          className="whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] transition-colors"
          style={{
            background: active === f.key ? "var(--accent-blue-bg)" : "rgba(255,255,255,0.03)",
            color: active === f.key ? "var(--accent-blue)" : "var(--text-muted)",
          }}
          onClick={() => onChange(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create filter panel overlay**

`src/components/filter-panel.tsx`:
```tsx
"use client";

import { useState } from "react";

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  members: { id: string; firstName: string }[];
  onApply: (filters: { status?: string; priority?: string; assigneeId?: string; sortBy?: string }) => void;
  initial: { status?: string; priority?: string; assigneeId?: string; sortBy?: string };
}

function ChipGroup({ label, options, selected, onSelect }: {
  label: string;
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.key}
            className="rounded-lg px-3 py-1.5 text-[12px] transition-colors"
            style={{
              background: selected === o.key ? "var(--accent-blue-bg)" : "rgba(255,255,255,0.03)",
              color: selected === o.key ? "var(--accent-blue)" : "var(--text-secondary)",
            }}
            onClick={() => onSelect(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterPanel({ open, onClose, members, onApply, initial }: FilterPanelProps) {
  const [status, setStatus] = useState(initial.status || "all");
  const [priority, setPriority] = useState(initial.priority || "all");
  const [assigneeId, setAssigneeId] = useState(initial.assigneeId || "all");
  const [sortBy, setSortBy] = useState(initial.sortBy || "newest");

  if (!open) return null;

  const handleReset = () => {
    setStatus("all");
    setPriority("all");
    setAssigneeId("all");
    setSortBy("newest");
  };

  const handleApply = () => {
    onApply({
      status: status === "all" ? undefined : status,
      priority: priority === "all" ? undefined : priority,
      assigneeId: assigneeId === "all" ? undefined : assigneeId,
      sortBy,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <div className="p-5">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[17px] font-semibold">Filters</span>
          <button className="text-[12px]" style={{ color: "var(--accent-blue)" }} onClick={handleReset}>
            Reset
          </button>
        </div>

        <ChipGroup
          label="Status"
          options={[
            { key: "all", label: "All" },
            { key: "todo", label: "To do" },
            { key: "in_progress", label: "In progress" },
            { key: "done", label: "Done" },
          ]}
          selected={status}
          onSelect={setStatus}
        />

        <ChipGroup
          label="Priority"
          options={[
            { key: "all", label: "All" },
            { key: "high", label: "High" },
            { key: "medium", label: "Medium" },
            { key: "low", label: "Low" },
          ]}
          selected={priority}
          onSelect={setPriority}
        />

        <ChipGroup
          label="Assignee"
          options={[
            { key: "all", label: "All" },
            ...members.map((m) => ({ key: m.id, label: m.firstName })),
          ]}
          selected={assigneeId}
          onSelect={setAssigneeId}
        />

        <ChipGroup
          label="Sort by"
          options={[
            { key: "newest", label: "Newest" },
            { key: "deadline", label: "Deadline" },
            { key: "priority", label: "Priority" },
          ]}
          selected={sortBy}
          onSelect={setSortBy}
        />

        <button
          className="mt-5 w-full rounded-[10px] py-3 text-[13px] font-medium text-white"
          style={{ background: "var(--accent-blue)" }}
          onClick={handleApply}
        >
          Apply Filters
        </button>

        <button
          className="mt-2 w-full py-2 text-[12px]"
          style={{ color: "var(--text-muted)" }}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/filter-chips.tsx src/components/filter-panel.tsx
git commit -m "feat: FilterChips bar + FilterPanel overlay"
```

---

### Task 14: Comment Thread + Reminder Chips

**Files:**
- Create: `src/components/comment-thread.tsx`, `src/components/reminder-chips.tsx`

- [ ] **Step 1: Create comment thread component**

`src/components/comment-thread.tsx`:
```tsx
"use client";

import { useState, useRef } from "react";

interface Comment {
  comment: { id: string; text: string; createdAt: string };
  author: { firstName: string };
}

interface CommentThreadProps {
  comments: Comment[];
  onAdd: (text: string) => Promise<void>;
}

function timeAgo(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CommentThread({ comments, onAdd }: CommentThreadProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    const text = value.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      await onAdd(text);
      setValue("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        Comments
      </div>

      {comments.length === 0 && (
        <p className="mb-3 text-[11px]" style={{ color: "var(--text-dim)" }}>No comments yet</p>
      )}

      <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.comment.id} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="text-[11px]">
              <span className="font-medium">{c.author.firstName}</span>
              <span className="ml-1.5" style={{ color: "var(--text-dim)", fontSize: "10px" }}>
                {timeAgo(c.comment.createdAt)}
              </span>
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {c.comment.text}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          ref={inputRef}
          className="flex-1 rounded-lg bg-transparent px-2.5 py-2 text-[11px] outline-none"
          style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" }}
          placeholder="Add a comment..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={loading}
        />
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[14px] text-white"
          style={{ background: "var(--accent-blue)" }}
          onClick={handleSend}
          disabled={loading}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create reminder chips component**

`src/components/reminder-chips.tsx`:
```tsx
"use client";

const PRESETS = ["1h", "6h", "12h", "24h", "48h", "3d", "7d", "30d"];

interface ReminderChipsProps {
  activeOffsets: string[];
  onToggle: (offset: string, enabled: boolean) => void;
}

export function ReminderChips({ activeOffsets, onToggle }: ReminderChipsProps) {
  return (
    <div>
      <div className="mb-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
        Reminders
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => {
          const active = activeOffsets.includes(p);
          return (
            <button
              key={p}
              className="rounded-[5px] px-2 py-0.5 text-[10px] transition-colors"
              style={{
                background: active ? "var(--accent-blue-bg)" : "rgba(255,255,255,0.03)",
                color: active ? "var(--accent-blue)" : "var(--text-muted)",
              }}
              onClick={() => onToggle(p, !active)}
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/comment-thread.tsx src/components/reminder-chips.tsx
git commit -m "feat: CommentThread + ReminderChips components"
```

---

### Task 15: Task Detail Bottom Sheet

**Files:**
- Create: `src/components/task-detail-sheet.tsx`

- [ ] **Step 1: Create task detail bottom sheet**

`src/components/task-detail-sheet.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import { useTaskDetail, useComments, useTaskActions, useMembers } from "@/hooks/use-board";
import { useTelegram } from "@/components/telegram-provider";
import { CommentThread } from "./comment-thread";
import { ReminderChips } from "./reminder-chips";

interface TaskDetailSheetProps {
  taskId: string | null;
  chatId: string;
  onClose: () => void;
}

const statusOptions = [
  { key: "todo", label: "To do", color: "var(--text-muted)" },
  { key: "in_progress", label: "In progress", color: "var(--accent-blue)" },
  { key: "done", label: "Done", color: "#22c55e" },
];

const priorityOptions = [
  { key: "low", label: "Low", color: "var(--text-dim)" },
  { key: "medium", label: "Medium", color: "var(--accent-yellow)" },
  { key: "high", label: "High", color: "var(--accent-orange)" },
];

function MetaChip({ label, value, valueColor, options, onChange }: {
  label: string;
  value: string;
  valueColor: string;
  options?: { key: string; label: string; color: string }[];
  onChange?: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="rounded-lg px-2.5 py-1.5 text-[11px]"
        style={{ background: "rgba(255,255,255,0.03)" }}
        onClick={() => options && setOpen(!open)}
      >
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <br />
        <span style={{ color: valueColor }}>{value}</span>
      </button>
      {open && options && (
        <div
          className="absolute left-0 top-full z-10 mt-1 rounded-lg border p-1"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-card)" }}
        >
          {options.map((o) => (
            <button
              key={o.key}
              className="block w-full rounded px-3 py-1.5 text-left text-[11px]"
              style={{ color: o.color }}
              onClick={() => { onChange?.(o.key); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskDetailSheet({ taskId, chatId, onClose }: TaskDetailSheetProps) {
  const { data: taskData, mutate: mutateTask } = useTaskDetail(taskId);
  const { data: commentsData } = useComments(taskId);
  const { data: membersData } = useMembers(chatId);
  const { updateTask, addComment } = useTaskActions(chatId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (taskData?.task) {
      setTitle(taskData.task.title);
      setDescription(taskData.task.description || "");
    }
  }, [taskData]);

  if (!taskId) return null;
  if (!taskData) return null;

  const { task, assignee, reminders } = taskData;
  const activeOffsets = (reminders || [])
    .filter((r: any) => !r.sent)
    .map((r: any) => r.offsetLabel);

  const handleUpdate = async (field: string, value: any) => {
    await updateTask(task.id, { [field]: value });
    mutateTask();
  };

  const currentStatus = statusOptions.find((s) => s.key === task.status) || statusOptions[0];
  const currentPriority = priorityOptions.find((p) => p.key === task.priority) || priorityOptions[1];
  const deadlineDate = new Date(task.deadline);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t p-4 pb-8"
        style={{ background: "var(--bg-secondary)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        {/* Handle */}
        <div className="mx-auto mb-3 h-1 w-9 rounded-full" style={{ background: "var(--text-dim)" }} />

        {/* Title */}
        <input
          className="mb-1 w-full bg-transparent text-[16px] font-semibold outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== task.title && handleUpdate("title", title)}
        />

        {/* Description */}
        <textarea
          className="mb-3 w-full resize-none bg-transparent text-[12px] outline-none"
          style={{ color: "var(--text-muted)" }}
          placeholder="Add description..."
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (task.description || "") && handleUpdate("description", description)}
        />

        {/* Meta chips */}
        <div className="mb-3 flex flex-wrap gap-2">
          <MetaChip
            label="Status"
            value={currentStatus.label}
            valueColor={currentStatus.color}
            options={statusOptions}
            onChange={(key) => handleUpdate("status", key)}
          />
          <MetaChip
            label="Priority"
            value={currentPriority.label}
            valueColor={currentPriority.color}
            options={priorityOptions}
            onChange={(key) => handleUpdate("priority", key)}
          />
          <MetaChip
            label="Assignee"
            value={assignee?.firstName || "None"}
            valueColor="var(--text-primary)"
            options={[
              { key: "", label: "None", color: "var(--text-muted)" },
              ...(membersData || []).map((m: any) => ({
                key: m.id,
                label: m.firstName,
                color: "var(--text-primary)",
              })),
            ]}
            onChange={(key) => handleUpdate("assigneeId", key || null)}
          />
          <MetaChip
            label="Due"
            value={deadlineDate.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            valueColor={deadlineDate.getTime() < Date.now() ? "var(--accent-red)" : "var(--text-primary)"}
          />
        </div>

        {/* Reminders */}
        <div className="mb-3">
          <ReminderChips
            activeOffsets={activeOffsets}
            onToggle={async (offset, enabled) => {
              await updateTask(task.id, { reminders: { [offset]: enabled } });
              mutateTask();
            }}
          />
        </div>

        {/* Comments */}
        <div className="border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <CommentThread
            comments={commentsData || []}
            onAdd={async (text) => {
              await addComment(task.id, text);
            }}
          />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/task-detail-sheet.tsx
git commit -m "feat: TaskDetailSheet bottom sheet with editable fields, reminders, comments"
```

---

### Task 16: Board View (Main Page)

**Files:**
- Create: `src/components/board-view.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create board view component**

`src/components/board-view.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useTelegram } from "@/components/telegram-provider";
import { useTasks, useMembers, useTaskActions } from "@/hooks/use-board";
import { TaskCard } from "./task-card";
import { QuickAdd } from "./quick-add";
import { FilterChips } from "./filter-chips";
import { FilterPanel } from "./filter-panel";
import { TaskDetailSheet } from "./task-detail-sheet";

export function BoardView() {
  const { chatId, ready } = useTelegram();
  const [quickFilter, setQuickFilter] = useState("all");
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, string>>({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Build API filters
  const apiFilters: Record<string, string> = { ...advancedFilters };
  if (quickFilter === "todo") apiFilters.status = "todo";
  if (quickFilter === "in_progress") apiFilters.status = "in_progress";
  if (quickFilter === "done") apiFilters.status = "done";

  const { data: tasksData, isLoading } = useTasks(chatId, apiFilters);
  const { data: membersData } = useMembers(chatId);
  const { createTask, updateTask } = useTaskActions(chatId);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  if (!chatId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p style={{ color: "var(--text-muted)" }}>Open this app from a Telegram group to get started.</p>
      </div>
    );
  }

  // Separate done tasks to bottom
  const allTasks = tasksData?.tasks || [];
  const activeTasks = allTasks.filter((t: any) => t.task.status !== "done");
  const doneTasks = allTasks.filter((t: any) => t.task.status === "done");
  const sortedTasks = [...activeTasks, ...doneTasks];

  // Filter "my tasks" client-side using telegram userId
  const { userId } = useTelegram();
  const filteredTasks = quickFilter === "my"
    ? sortedTasks.filter((t: any) => t.assignee?.telegramUserId?.toString() === userId)
    : sortedTasks;

  const boardName = tasksData?.board?.name || "Task Board";
  const memberCount = membersData?.length || 0;

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-5">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-[17px] font-semibold tracking-tight">{boardName}</div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {memberCount} member{memberCount !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[14px]"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          onClick={() => setFilterPanelOpen(true)}
        >
          ☰
        </button>
      </div>

      {/* Filter chips */}
      <div className="mb-4">
        <FilterChips active={quickFilter} onChange={setQuickFilter} />
      </div>

      {/* Quick add */}
      <div className="mb-3">
        <QuickAdd onAdd={async (title) => { await createTask({ title }); }} />
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-2">
        {isLoading && (
          <p className="py-8 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
            Loading tasks...
          </p>
        )}

        {!isLoading && filteredTasks.length === 0 && (
          <p className="py-8 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
            No tasks yet. Add one above.
          </p>
        )}

        {filteredTasks.map((item: any) => (
          <TaskCard
            key={item.task.id}
            task={item.task}
            assignee={item.assignee}
            commentCount={item.commentCount || 0}
            onTap={setSelectedTaskId}
            onToggleStatus={async (id, newStatus) => {
              await updateTask(id, { status: newStatus });
            }}
          />
        ))}
      </div>

      {/* Task detail sheet */}
      <TaskDetailSheet
        taskId={selectedTaskId}
        chatId={chatId}
        onClose={() => setSelectedTaskId(null)}
      />

      {/* Filter panel */}
      <FilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        members={(membersData || []).map((m: any) => ({ id: m.id, firstName: m.firstName }))}
        initial={advancedFilters}
        onApply={(filters) => {
          const f: Record<string, string> = {};
          if (filters.status) f.status = filters.status;
          if (filters.priority) f.priority = filters.priority;
          if (filters.assigneeId) f.assigneeId = filters.assigneeId;
          if (filters.sortBy) f.sortBy = filters.sortBy;
          setAdvancedFilters(f);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update page.tsx to use BoardView**

`src/app/page.tsx`:
```tsx
import { BoardView } from "@/components/board-view";

export default function Home() {
  return <BoardView />;
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/board-view.tsx src/app/page.tsx
git commit -m "feat: BoardView main page with task list, filters, quick-add, detail sheet"
```

---

### Task 17: Deploy + Set Webhook

- [ ] **Step 1: Deploy to Vercel**

```bash
cd /Users/emadexus/Documents/Mine/Projects/etasks
vercel --prod
```

Note the production URL from the output.

- [ ] **Step 2: Set NEXT_PUBLIC_APP_URL in Vercel**

```bash
echo "<production-url>" | vercel env add NEXT_PUBLIC_APP_URL production preview development
```

- [ ] **Step 3: Redeploy with the new env var**

```bash
vercel --prod
```

- [ ] **Step 4: Set Telegram webhook**

```bash
curl -X POST "https://api.telegram.org/bot$(grep TG_BOT_TOKEN .env | cut -d= -f2)/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"<production-url>/api/telegram/webhook","allowed_updates":["message","my_chat_member","chat_member"]}'
```

Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`

Note: `allowed_updates` must include `chat_member` for member join/leave tracking and `my_chat_member` for detecting when the bot is added/removed from groups.

- [ ] **Step 5: Get bot username and set it**

```bash
curl "https://api.telegram.org/bot$(grep TG_BOT_TOKEN .env | cut -d= -f2)/getMe"
```

Use the `username` from the response:

```bash
echo "<bot-username>" | vercel env add NEXT_PUBLIC_BOT_USERNAME production preview development
```

- [ ] **Step 6: Final redeploy**

```bash
vercel --prod
```

- [ ] **Step 7: Verify webhook info**

```bash
curl "https://api.telegram.org/bot$(grep TG_BOT_TOKEN .env | cut -d= -f2)/getWebhookInfo"
```

Expected: shows the production URL, `pending_update_count: 0`, no errors.

- [ ] **Step 8: Commit any remaining changes**

```bash
git add -A
git commit -m "deploy: production deployment with Telegram webhook configured"
```

---

### Task 18: End-to-End Smoke Test

- [ ] **Step 1: Add bot to a test Telegram group**

Add the bot to a test group chat. Verify:
- Bot sends welcome message with "Open Task Board" button
- Board is created in database

- [ ] **Step 2: Open mini app**

Click "Open Task Board" in the group. Verify:
- Mini app loads with frosted dark theme
- Shows board with "No tasks yet"

- [ ] **Step 3: Create a task**

Type a title in the quick-add input and press Enter. Verify:
- Task appears in the list
- Bot sends notification to the group
- Default 24h reminder is scheduled

- [ ] **Step 4: Edit task details**

Tap the task to open the detail sheet. Verify:
- Bottom sheet opens
- Can change status, priority, assignee
- Can toggle reminder presets
- Can add a comment

- [ ] **Step 5: Verify notifications**

- Change assignee → check DM to assignee
- Add comment → check group notification + assignee DM
- Verify reminder appears in QStash dashboard (Upstash console)

- [ ] **Step 6: Test filters**

- Toggle filter chips (All, My tasks, To do, In progress, Done)
- Open filter panel, apply filters, verify list updates
