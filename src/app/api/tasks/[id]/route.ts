import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { tasks, taskReminders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTaskWithDetails, getMemberByTelegramId, getRemindersForTask } from "@/lib/db/queries";
import { cancelReminders, scheduleReminders, toggleReminder } from "@/lib/qstash/reminders";

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

  if (body.status === "done") {
    await cancelReminders(id);
  }

  // Handle reminder toggles: { reminders: { "1h": true, "7d": false } }
  if (body.reminders) {
    const taskDeadline = body.deadline ? new Date(body.deadline) : result.task.deadline;
    for (const [offset, enabled] of Object.entries(body.reminders)) {
      await toggleReminder(id, offset, taskDeadline, enabled as boolean);
    }
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

  await cancelReminders(id);
  await db.delete(taskReminders).where(eq(taskReminders.taskId, id));
  const { comments } = await import("@/lib/db/schema");
  await db.delete(comments).where(eq(comments.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));

  return NextResponse.json({ ok: true });
}
