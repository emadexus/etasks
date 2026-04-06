import { NextRequest, NextResponse } from "next/server";
import { getAdminOnlyAuth, getAuthUser } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { tasks, members, boards, users, comments, taskAttachments } from "@/lib/db/schema";
import { eq, and, desc, asc, sql, gte, lt, isNull, or, like } from "drizzle-orm";
import { getBoardByChatId, upsertMember, getOrCreateUser } from "@/lib/db/queries";
import { notifyGroup, notifyUser, formatNewTask, botT } from "@/lib/telegram/notify";
import { scheduleReminders } from "@/lib/qstash/reminders";
import type { InlineKeyboardMarkup } from "grammy/types";

/**
 * Admin API: Full task management.
 * Auth: Authorization: Bearer <ADMIN_API_KEY>
 *
 * GET /api/admin/tasks?chatId=...&status=...&priority=...&assigneeId=...&ownerId=...&filter=...&projectId=...&q=...&sortBy=...&limit=...&offset=...
 * POST /api/admin/tasks { chatId, title, authorTelegramId, authorName, assigneeTelegramId, ... }
 */

export async function GET(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const chatId = p.get("chatId");
  const status = p.get("status");
  const priority = p.get("priority");
  const assigneeId = p.get("assigneeId");
  const ownerId = p.get("ownerId");
  const projectId = p.get("projectId");
  const filter = p.get("filter");
  const q = p.get("q");
  const sortBy = p.get("sortBy") || "newest";
  const limit = Math.min(parseInt(p.get("limit") || "50"), 200);
  const offset = parseInt(p.get("offset") || "0");

  const conditions: any[] = [];

  // Board filter
  if (chatId) {
    const board = await getBoardByChatId(BigInt(chatId));
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    conditions.push(eq(tasks.boardId, board.id));
  }

  // Status filter
  if (status) {
    conditions.push(eq(tasks.status, status as any));
  }

  // Priority filter
  if (priority) {
    conditions.push(eq(tasks.priority, priority as any));
  }

  // Assignee filter
  if (assigneeId) {
    conditions.push(eq(tasks.assigneeId, assigneeId));
  }

  // Owner filter
  if (ownerId) {
    conditions.push(eq(tasks.ownerId, ownerId));
  }

  // Project filter
  if (projectId) {
    conditions.push(eq(tasks.projectId, projectId));
  }

  // Smart filters
  if (filter) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    const next7End = new Date(todayStart);
    next7End.setDate(next7End.getDate() + 7);

    switch (filter) {
      case "overdue":
        conditions.push(sql`${tasks.status} != 'done'`);
        conditions.push(lt(tasks.dateDue, now));
        break;
      case "today":
        conditions.push(sql`${tasks.status} != 'done'`);
        conditions.push(or(
          and(gte(tasks.dateDue, todayStart), lt(tasks.dateDue, tomorrowStart)),
          and(gte(tasks.datePlanned, todayStart), lt(tasks.datePlanned, tomorrowStart)),
        ));
        break;
      case "tomorrow":
        conditions.push(sql`${tasks.status} != 'done'`);
        conditions.push(or(
          and(gte(tasks.dateDue, tomorrowStart), lt(tasks.dateDue, tomorrowEnd)),
          and(gte(tasks.datePlanned, tomorrowStart), lt(tasks.datePlanned, tomorrowEnd)),
        ));
        break;
      case "next7days":
        conditions.push(sql`${tasks.status} != 'done'`);
        conditions.push(or(
          and(gte(tasks.dateDue, todayStart), lt(tasks.dateDue, next7End)),
          and(gte(tasks.datePlanned, todayStart), lt(tasks.datePlanned, next7End)),
        ));
        break;
      case "completed":
        conditions.push(eq(tasks.status, "done"));
        break;
      case "active":
        conditions.push(sql`${tasks.status} != 'done'`);
        break;
    }
  }

  // Search by title
  if (q) {
    conditions.push(like(tasks.title, `%${q}%`));
  }

  const orderBy = sortBy === "deadline" ? asc(tasks.dateDue)
    : sortBy === "priority" ? desc(tasks.priority)
    : sortBy === "updated" ? desc(tasks.updatedAt)
    : desc(tasks.createdAt);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db.select({
    task: tasks,
    assignee: {
      id: members.id,
      username: members.username,
      firstName: members.firstName,
      telegramUserId: members.telegramUserId,
    },
    commentCount: sql<number>`(SELECT count(*) FROM comments WHERE comments.task_id = ${tasks.id})`.as("comment_count"),
    attachmentCount: sql<number>`(SELECT count(*) FROM task_attachments WHERE task_attachments.task_id = ${tasks.id})`.as("attachment_count"),
  })
    .from(tasks)
    .leftJoin(members, eq(tasks.assigneeId, members.id))
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Count total for pagination
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(tasks)
    .where(whereClause);

  const serialized = result.map((r) => ({
    ...r,
    assignee: r.assignee?.id ? {
      ...r.assignee,
      telegramUserId: r.assignee.telegramUserId.toString(),
    } : null,
  }));

  return NextResponse.json({ tasks: serialized, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const body = await req.json();
  const {
    chatId,
    title,
    description,
    priority,
    status: taskStatus,
    dateDue,
    datePlanned,
    notifyAt,
    recurrenceRule,
    projectId,
    // Admin-specific: create on behalf of a user
    authorTelegramId,
    authorName,
    assigneeTelegramId,
    assigneeName,
    createdVia,
    notify: shouldNotify,
    reminderOffsets,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  // Resolve author user (who created the task)
  const authorTgId = BigInt(authorTelegramId || admin.userId);
  const authorUser = await getOrCreateUser(authorTgId, null, authorName || admin.firstName);

  if (chatId) {
    // Board task
    const board = await getBoardByChatId(BigInt(chatId));
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const lang = board.language || "en";

    // Upsert author as member
    const authorMember = await upsertMember(board.id, authorTgId, null, authorName || admin.firstName);

    // Resolve assignee
    let assigneeMemberId: string | null = null;
    let assigneeUsername: string | null = null;
    let assigneeMember: any = null;
    if (assigneeTelegramId) {
      assigneeMember = await upsertMember(board.id, BigInt(assigneeTelegramId), null, assigneeName || "User");
      assigneeMemberId = assigneeMember.id;
      assigneeUsername = assigneeMember.username;
    }

    const dueDate = dateDue ? new Date(dateDue) : null;

    const [task] = await db.insert(tasks).values({
      boardId: board.id,
      ownerId: authorUser.id,
      title,
      description: description || null,
      status: taskStatus || "todo",
      priority: priority || "medium",
      assigneeId: assigneeMemberId,
      createdBy: authorMember.id,
      dateDue: dueDate,
      datePlanned: datePlanned ? new Date(datePlanned) : null,
      notifyAt: notifyAt ? new Date(notifyAt) : null,
      recurrenceRule: recurrenceRule || null,
      createdVia: createdVia || "admin_api",
    }).returning();

    // Schedule reminders
    if (dueDate) {
      const offsets = reminderOffsets || ["24h"];
      await scheduleReminders(task.id, dueDate, offsets);
    }

    // Notify group & assignee if requested (default: true)
    if (shouldNotify !== false) {
      if (assigneeMember) {
        await notifyUser(BigInt(assigneeTelegramId), formatNewTask(title, priority || "medium", assigneeUsername, dueDate, lang));
      }

      const taskKeyboard: InlineKeyboardMarkup = {
        inline_keyboard: [[
          { text: botT("openTask", lang), url: `https://t.me/e_task_bot/open?startapp=task${task.id}` }
        ]]
      };
      await notifyGroup(
        board.telegramChatId,
        formatNewTask(title, priority || "medium", assigneeUsername, dueDate, lang),
        taskKeyboard
      );
    }

    return NextResponse.json(task, { status: 201 });
  }

  // Personal / project task
  const [task] = await db.insert(tasks).values({
    boardId: null,
    ownerId: authorUser.id,
    projectId: projectId || null,
    title,
    description: description || null,
    status: taskStatus || "todo",
    priority: priority || "medium",
    assigneeId: null,
    createdBy: null,
    dateDue: dateDue ? new Date(dateDue) : null,
    datePlanned: datePlanned ? new Date(datePlanned) : null,
    notifyAt: notifyAt ? new Date(notifyAt) : null,
    recurrenceRule: recurrenceRule || null,
    createdVia: createdVia || "admin_api",
  }).returning();

  if (dateDue) {
    const offsets = reminderOffsets || ["24h"];
    await scheduleReminders(task.id, new Date(dateDue), offsets);
  }

  return NextResponse.json(task, { status: 201 });
}
