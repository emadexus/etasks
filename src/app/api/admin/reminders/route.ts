import { NextRequest, NextResponse } from "next/server";
import { getAdminOnlyAuth } from "@/lib/telegram/auth";
import { getRemindersForTask, getTaskWithDetails } from "@/lib/db/queries";
import { scheduleReminders, cancelReminders, toggleReminder } from "@/lib/qstash/reminders";

/**
 * Admin API: Reminder management.
 *
 * GET /api/admin/reminders?taskId=...
 * POST /api/admin/reminders { taskId, offsets: ["1h", "24h", "7d"] }
 * DELETE /api/admin/reminders?taskId=...  (cancel all)
 */

export async function GET(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const reminders = await getRemindersForTask(taskId);
  return NextResponse.json(reminders);
}

export async function POST(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const body = await req.json();
  const { taskId, offsets } = body;

  if (!taskId || !offsets || !Array.isArray(offsets)) {
    return NextResponse.json({ error: "taskId and offsets[] required" }, { status: 400 });
  }

  const taskResult = await getTaskWithDetails(taskId);
  if (!taskResult) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const deadline = taskResult.task.dateDue;
  if (!deadline) {
    return NextResponse.json({ error: "Task has no due date" }, { status: 400 });
  }

  // Dedupe against existing pending reminders so repeat POSTs are idempotent.
  // Sent reminders stay as history but don't count as duplicates — if the
  // user re-adds a 6h reminder AFTER the 6h one already fired, that's valid.
  const existing = await getRemindersForTask(taskId);
  const pendingOffsets = new Set(
    existing.filter((r: { sent: boolean; offsetLabel: string }) => !r.sent).map((r) => r.offsetLabel),
  );
  const newOffsets = offsets.filter((o: string) => !pendingOffsets.has(o));

  if (newOffsets.length > 0) {
    await scheduleReminders(taskId, deadline, newOffsets);
  }

  const reminders = await getRemindersForTask(taskId);
  return NextResponse.json(reminders);
}

export async function DELETE(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  await cancelReminders(taskId);
  return NextResponse.json({ ok: true });
}
