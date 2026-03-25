import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/telegram/auth";
import { getBoardByChatId, getMemberByTelegramId, upsertMember } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { tasks, members, comments } from "@/lib/db/schema";
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

  await scheduleReminders(task.id, deadlineDate, ["24h"]);

  let assigneeUsername: string | null = null;
  if (assigneeId) {
    const assignee = await db.select().from(members).where(eq(members.id, assigneeId)).limit(1);
    if (assignee[0]) {
      assigneeUsername = assignee[0].username;
      await notifyUser(assignee[0].telegramUserId, formatNewTask(title, priority || "medium", assigneeUsername, deadlineDate));
    }
  }

  await notifyGroup(
    board.telegramChatId,
    formatNewTask(title, priority || "medium", assigneeUsername, deadlineDate)
  );

  return NextResponse.json(task, { status: 201 });
}
