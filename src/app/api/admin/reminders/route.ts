import { NextRequest, NextResponse } from "next/server";
import { getAdminOnlyAuth } from "@/lib/telegram/auth";
import { getRemindersForTask } from "@/lib/db/queries";
import { scheduleReminder, cancelReminder, cancelReminders } from "@/lib/qstash/reminders";

/**
 * Admin API: Reminder management — absolute UTC timestamps only.
 *
 * GET    /api/admin/reminders?taskId=...         — list reminders for a task
 * POST   /api/admin/reminders                    — { taskId, remindAt: ISO8601 }
 *                                                  OR { taskId, remindAts: [ISO, ISO, ...] }
 * DELETE /api/admin/reminders?id=<reminder_id>   — delete one specific reminder
 * DELETE /api/admin/reminders?taskId=<task_id>   — delete all reminders for a task
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
  const { taskId, remindAt, remindAts } = body;

  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const times: string[] = remindAts ?? (remindAt ? [remindAt] : []);
  if (times.length === 0) {
    return NextResponse.json(
      { error: "remindAt or remindAts required (ISO 8601 UTC timestamp)" },
      { status: 400 },
    );
  }

  for (const iso of times) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: `invalid remindAt: ${iso}` }, { status: 400 });
    }
    await scheduleReminder(taskId, d);
  }

  const reminders = await getRemindersForTask(taskId);
  return NextResponse.json(reminders);
}

export async function DELETE(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  const taskId = req.nextUrl.searchParams.get("taskId");

  if (id) {
    await cancelReminder(id);
    return NextResponse.json({ ok: true, deleted: id });
  }
  if (taskId) {
    await cancelReminders(taskId);
    return NextResponse.json({ ok: true, taskId });
  }
  return NextResponse.json({ error: "id or taskId required" }, { status: 400 });
}
