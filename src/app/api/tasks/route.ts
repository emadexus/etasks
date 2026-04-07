import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, getAuthUser } from "@/lib/telegram/auth";
import { getBoardByChatId, getMemberByTelegramId, upsertMember } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { tasks, members, comments, boards } from "@/lib/db/schema";
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";
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

  const status = req.nextUrl.searchParams.get("status");
  const priority = req.nextUrl.searchParams.get("priority");
  const assigneeId = req.nextUrl.searchParams.get("assigneeId");
  const sortBy = req.nextUrl.searchParams.get("sortBy") || "newest";

  const showArchived = req.nextUrl.searchParams.get("archived") === "true";
  const conditions = [eq(tasks.boardId, board.id)];
  if (showArchived) {
    conditions.push(sql`${tasks.archivedAt} IS NOT NULL`);
  } else {
    conditions.push(sql`${tasks.archivedAt} IS NULL`);
  }
  if (status) conditions.push(eq(tasks.status, status as any));
  if (priority) conditions.push(eq(tasks.priority, priority as any));
  if (assigneeId) conditions.push(eq(tasks.assigneeId, assigneeId));

  const orderBy = sortBy === "deadline" ? asc(tasks.dateDue)
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

  const serialized = result.map((r) => ({
    ...r,
    assignee: r.assignee?.id ? {
      ...r.assignee,
      telegramUserId: r.assignee.telegramUserId.toString(),
    } : null,
  }));

  return NextResponse.json({ tasks: serialized, board: { id: board.id, name: board.name } });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { chatId, title, description, priority, assigneeId, dateDue, datePlanned, projectId, notifyAt, recurrenceRule } = body;

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  // Board task (group) vs personal/project task
  if (chatId) {
    const board = await getBoardByChatId(BigInt(chatId));
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const lang = board.language || "en";
    const member = await upsertMember(board.id, auth.userId, auth.username, auth.firstName);

    const dueDate = dateDue ? new Date(dateDue) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [task] = await db.insert(tasks).values({
      boardId: board.id,
      ownerId: auth.dbUserId,
      title,
      description: description || null,
      priority: priority || "medium",
      assigneeId: assigneeId || null,
      createdBy: member.id,
      dateDue: dueDate,
      datePlanned: datePlanned ? new Date(datePlanned) : null,
      notifyAt: notifyAt ? new Date(notifyAt) : null,
      recurrenceRule: recurrenceRule || null,
    }).returning();

    await scheduleReminders(task.id, dueDate, ["24h"]);

    let assigneeUsername: string | null = null;
    if (assigneeId) {
      const assignee = await db.select().from(members).where(eq(members.id, assigneeId)).limit(1);
      if (assignee[0]) {
        assigneeUsername = assignee[0].username;
        await notifyUser(assignee[0].telegramUserId, formatNewTask(task.id, title, priority || "medium", assigneeUsername, dueDate, lang));
      }
    }

    await notifyGroup(
      board.telegramChatId,
      formatNewTask(task.id, title, priority || "medium", assigneeUsername, dueDate, lang),
    );

    return NextResponse.json(task, { status: 201 });
  }

  // Personal or project task
  const [task] = await db.insert(tasks).values({
    boardId: null,
    ownerId: auth.dbUserId,
    projectId: projectId || null,
    title,
    description: description || null,
    priority: priority || "medium",
    assigneeId: null,
    createdBy: null,
    dateDue: dateDue ? new Date(dateDue) : null,
    datePlanned: datePlanned ? new Date(datePlanned) : null,
    notifyAt: notifyAt ? new Date(notifyAt) : null,
    recurrenceRule: recurrenceRule || null,
  }).returning();

  if (dateDue) {
    await scheduleReminders(task.id, new Date(dateDue), ["24h"]);
  }

  return NextResponse.json(task, { status: 201 });
}
