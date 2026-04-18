import { NextRequest, NextResponse } from "next/server";
import { getAdminOnlyAuth } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { tasks, taskReminders, comments, taskAttachments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTaskWithDetails, getRemindersForTask } from "@/lib/db/queries";
import { cancelReminders, scheduleReminder } from "@/lib/qstash/reminders";
import { createNextRecurrence } from "@/lib/recurrence";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: "Invalid UUID format" }, { status: 400 });

  const result = await getTaskWithDetails(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reminders = await getRemindersForTask(id);
  const attachments = await db.select().from(taskAttachments)
    .where(eq(taskAttachments.taskId, id));

  return NextResponse.json({
    task: result.task,
    assignee: result.assignee ? {
      ...result.assignee,
      telegramUserId: result.assignee.telegramUserId.toString(),
    } : null,
    reminders,
    attachments,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: "Invalid UUID format" }, { status: 400 });

  const result = await getTaskWithDetails(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = result.task;
  const body = await req.json();
  const updates: Record<string, any> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId;
  if (body.dateDue !== undefined) updates.dateDue = body.dateDue ? new Date(body.dateDue) : null;
  if (body.datePlanned !== undefined) updates.datePlanned = body.datePlanned ? new Date(body.datePlanned) : null;
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

  // Handle deadline changes: cancel existing reminders, schedule new
  // due-date auto-reminder. Manual extra reminders must be re-added
  // (since they're absolute, they don't auto-shift with due changes).
  if (body.dateDue !== undefined) {
    await cancelReminders(id);
    if (body.dateDue) {
      await scheduleReminder(id, new Date(body.dateDue));
    }
  }

  if (body.status === "done") {
    await cancelReminders(id);
    if (task.recurrenceRule) {
      await createNextRecurrence(task);
    }
  }

  // Handle reminder mutations: { addReminders: [ISO, ...], removeReminderIds: [id, ...] }
  if (Array.isArray(body.addReminders)) {
    const { scheduleReminder } = await import("@/lib/qstash/reminders");
    for (const iso of body.addReminders) {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) await scheduleReminder(id, d);
    }
  }
  if (Array.isArray(body.removeReminderIds)) {
    const { cancelReminder } = await import("@/lib/qstash/reminders");
    for (const rid of body.removeReminderIds) await cancelReminder(rid);
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: "Invalid UUID format" }, { status: 400 });

  const result = await getTaskWithDetails(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await cancelReminders(id);
  await db.delete(taskReminders).where(eq(taskReminders.taskId, id));
  await db.delete(taskAttachments).where(eq(taskAttachments.taskId, id));
  await db.delete(comments).where(eq(comments.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));

  return NextResponse.json({ ok: true });
}
