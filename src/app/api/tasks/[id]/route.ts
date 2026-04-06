import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { tasks, taskReminders, comments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTaskWithDetails, getMemberByTelegramId, getRemindersForTask } from "@/lib/db/queries";
import { cancelReminders, scheduleReminders, toggleReminder } from "@/lib/qstash/reminders";
import { createNextRecurrence } from "@/lib/recurrence";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getTaskWithDetails(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reminders = await getRemindersForTask(id);

  return NextResponse.json({
    task: result.task,
    assignee: result.assignee ? {
      ...result.assignee,
      telegramUserId: result.assignee.telegramUserId.toString(),
    } : null,
    reminders,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getTaskWithDetails(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = result.task;

  // Authorization: personal task → check ownerId; board task → check membership
  if (task.boardId) {
    const member = await getMemberByTelegramId(task.boardId, auth.userId);
    if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });
    const isCreator = task.createdBy === member.id;
    const isAdmin = member.role === "admin";
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else {
    if (task.ownerId !== auth.dbUserId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  const body = await req.json();
  const updates: Record<string, any> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId;
  if (body.dateDue !== undefined) updates.dateDue = body.dateDue ? new Date(body.dateDue) : null;
  if (body.datePlanned !== undefined) updates.datePlanned = body.datePlanned ? new Date(body.datePlanned) : null;
  if (body.notifyAt !== undefined) updates.notifyAt = body.notifyAt ? new Date(body.notifyAt) : null;
  if (body.recurrenceRule !== undefined) updates.recurrenceRule = body.recurrenceRule;
  if (body.projectId !== undefined) updates.projectId = body.projectId || null;

  if (body.status === "done") {
    updates.completedAt = new Date();
  } else if (body.status && body.status !== "done" && task.status === "done") {
    updates.completedAt = null;
  }

  updates.updatedAt = new Date();

  const [updated] = await db.update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning();

  // Handle deadline/dateDue changes
  if (body.dateDue !== undefined) {
    await cancelReminders(id);
    if (body.dateDue) {
      const existingReminders = await getRemindersForTask(id);
      const activeOffsets = existingReminders
        .filter(r => !r.sent)
        .map(r => r.offsetLabel);
      if (activeOffsets.length > 0) {
        await scheduleReminders(id, new Date(body.dateDue), activeOffsets);
      }
    }
  }

  if (body.status === "done") {
    await cancelReminders(id);

    // Handle recurrence: create next task instance
    if (task.recurrenceRule) {
      await createNextRecurrence(task);
    }
  }

  // Handle reminder toggles: { reminders: { "1h": true, "7d": false } }
  if (body.reminders) {
    const taskDeadline = body.dateDue ? new Date(body.dateDue) : task.dateDue;
    if (taskDeadline) {
      for (const [offset, enabled] of Object.entries(body.reminders)) {
        await toggleReminder(id, offset, taskDeadline, enabled as boolean);
      }
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getTaskWithDetails(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Authorization: personal task → check ownerId; board task → check membership
  if (result.task.boardId) {
    const member = await getMemberByTelegramId(result.task.boardId, auth.userId);
    if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });
    const isCreator = result.task.createdBy === member.id;
    const isAdmin = member.role === "admin";
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else {
    if (result.task.ownerId !== auth.dbUserId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  await cancelReminders(id);
  await db.delete(taskReminders).where(eq(taskReminders.taskId, id));
  await db.delete(comments).where(eq(comments.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));

  return NextResponse.json({ ok: true });
}
