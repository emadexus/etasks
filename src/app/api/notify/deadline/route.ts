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

  const taskResult = await db.select({
    task: tasks,
    assignee: members,
    board: boards,
  })
    .from(tasks)
    .leftJoin(boards, eq(tasks.boardId, boards.id))
    .leftJoin(members, eq(tasks.assigneeId, members.id))
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (taskResult.length === 0) {
    return NextResponse.json({ ok: true, skipped: "task not found" });
  }

  const { task, assignee, board } = taskResult[0];

  if (task.status === "done") {
    return NextResponse.json({ ok: true, skipped: "task done" });
  }

  await db.update(taskReminders)
    .set({ sent: true })
    .where(eq(taskReminders.id, reminderId));

  if (!task.dateDue) {
    return NextResponse.json({ ok: true, skipped: "no due date" });
  }

  const lang = board?.language || "en";

  const msLeft = task.dateDue.getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.round(msLeft / (60 * 60 * 1000)));
  const timeLeft = hoursLeft >= 24
    ? `${Math.round(hoursLeft / 24)}d`
    : `${hoursLeft}h`;

  const message = formatDeadlineReminder(
    task.title,
    timeLeft,
    assignee?.username || null,
    lang,
  );

  if (board) {
    await notifyGroup(board.telegramChatId, message);
  }

  if (assignee) {
    await notifyUser(assignee.telegramUserId, message);
  }

  return NextResponse.json({ ok: true });
}

export const POST = verifySignatureAppRouter(handler);
