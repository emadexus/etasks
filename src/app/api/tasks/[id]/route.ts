import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { tasks, taskReminders, comments, members, boards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTaskWithDetails, getMemberByTelegramId, getRemindersForTask } from "@/lib/db/queries";
import { cancelReminders, scheduleReminders, toggleReminder } from "@/lib/qstash/reminders";
import { createNextRecurrence } from "@/lib/recurrence";
import { notifyGroup, formatAssigneeChanged } from "@/lib/telegram/notify";

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

  // Authorization: task owner can always edit; board tasks require membership
  const isOwner = task.ownerId === auth.dbUserId;
  if (task.boardId && !isOwner) {
    const member = await getMemberByTelegramId(task.boardId, auth.userId);
    if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  } else if (!task.boardId && !isOwner) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
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
  if (body.recurrenceRule !== undefined) updates.recurrenceRule = body.recurrenceRule;
  if (body.projectId !== undefined) updates.projectId = body.projectId || null;
  if (body.tags !== undefined) updates.tags = body.tags ? JSON.stringify(body.tags) : null;
  if (body.checklist !== undefined) updates.checklist = body.checklist ? JSON.stringify(body.checklist) : null;
  if (body.archivedAt !== undefined) updates.archivedAt = body.archivedAt ? new Date(body.archivedAt) : null;

  // Move task to a different board (or to personal inbox with boardId=null)
  if (body.boardId !== undefined) {
    if (body.boardId === null) {
      // Moving to personal inbox — keep assignee, clear board-specific fields
      updates.boardId = null;
      updates.createdBy = null;
    } else if (body.boardId !== task.boardId) {
      // Verify user is a member of the destination board
      const destMember = await getMemberByTelegramId(body.boardId, auth.userId);
      if (!destMember) {
        return NextResponse.json({ error: "Not a member of destination board" }, { status: 403 });
      }
      updates.boardId = body.boardId;
      updates.projectId = null;

      // Re-resolve assignee on destination board (member IDs are per-board)
      if (task.assigneeId) {
        const oldAssignee = await db.select().from(members).where(eq(members.id, task.assigneeId)).limit(1);
        if (oldAssignee.length > 0) {
          const { upsertMember } = await import("@/lib/db/queries");
          const newAssignee = await upsertMember(
            body.boardId,
            oldAssignee[0].telegramUserId,
            oldAssignee[0].username,
            oldAssignee[0].firstName
          );
          updates.assigneeId = newAssignee.id;
        } else {
          updates.assigneeId = null;
        }
      }

      // Re-resolve createdBy on destination board
      if (task.createdBy) {
        const oldCreator = await db.select().from(members).where(eq(members.id, task.createdBy)).limit(1);
        if (oldCreator.length > 0) {
          const { upsertMember } = await import("@/lib/db/queries");
          const newCreator = await upsertMember(
            body.boardId,
            oldCreator[0].telegramUserId,
            oldCreator[0].username,
            oldCreator[0].firstName
          );
          updates.createdBy = newCreator.id;
        } else {
          updates.createdBy = null;
        }
      }
    }
  }

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

  // Notify group on assignment change
  if (body.assigneeId !== undefined && task.boardId) {
    try {
      const board = await db.select().from(boards).where(eq(boards.id, task.boardId)).limit(1);
      if (board[0]) {
        const lang = board[0].language || "en";
        let assigneeName: string | null = null;
        if (body.assigneeId) {
          const assignee = await db.select().from(members).where(eq(members.id, body.assigneeId)).limit(1);
          assigneeName = assignee[0]?.username ? `@${assignee[0].username}` : assignee[0]?.firstName || null;
        }
        const changedBy = auth.username ? `@${auth.username}` : auth.firstName;
        notifyGroup(board[0].telegramChatId, formatAssigneeChanged(id, task.title, assigneeName, changedBy, lang));
      }
    } catch (e) {
      console.error("Failed to notify on assignment:", e);
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

  // Authorization: task owner can always delete; board tasks require membership
  const isOwner = result.task.ownerId === auth.dbUserId;
  if (result.task.boardId && !isOwner) {
    const member = await getMemberByTelegramId(result.task.boardId, auth.userId);
    if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  } else if (!result.task.boardId && !isOwner) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await cancelReminders(id);
  await db.delete(taskReminders).where(eq(taskReminders.taskId, id));
  await db.delete(comments).where(eq(comments.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));

  return NextResponse.json({ ok: true });
}
