import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, members, boards, taskReminders } from "@/lib/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { notifyGroup, notifyUser, formatDeadlineReminder } from "@/lib/telegram/notify";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return processReminders();
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return processReminders();
}

async function processReminders() {
  const now = new Date();

  const dueReminders = await db.select({
    reminder: taskReminders,
    task: tasks,
    assignee: members,
    board: boards,
  })
    .from(taskReminders)
    .innerJoin(tasks, eq(taskReminders.taskId, tasks.id))
    .leftJoin(boards, eq(tasks.boardId, boards.id))
    .leftJoin(members, eq(tasks.assigneeId, members.id))
    .where(and(
      eq(taskReminders.sent, false),
      lte(taskReminders.remindAt, now),
    ));

  let sent = 0;
  let skipped = 0;

  for (const { reminder, task, assignee, board } of dueReminders) {
    if (task.status === "done" || !task.dateDue) {
      await db.update(taskReminders).set({ sent: true }).where(eq(taskReminders.id, reminder.id));
      skipped++;
      continue;
    }

    const lang = board?.language || "en";
    const msLeft = task.dateDue.getTime() - Date.now();
    const hoursLeft = Math.max(0, Math.round(msLeft / (60 * 60 * 1000)));
    const timeLeft = hoursLeft >= 24 ? `${Math.round(hoursLeft / 24)}d` : `${hoursLeft}h`;

    const message = formatDeadlineReminder(
      task.id,
      task.title,
      timeLeft,
      assignee?.username || null,
      lang,
    );

    try {
      if (board) {
        await notifyGroup(board.telegramChatId, message);
      }
      if (assignee) {
        await notifyUser(assignee.telegramUserId, message);
      }
      sent++;
    } catch (e) {
      console.error("Failed to send reminder for task", task.id, e);
    }

    await db.update(taskReminders).set({ sent: true }).where(eq(taskReminders.id, reminder.id));
  }

  return NextResponse.json({ ok: true, processed: dueReminders.length, sent, skipped });
}
