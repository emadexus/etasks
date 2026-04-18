import { db } from "@/lib/db";
import { taskReminders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Reminder scheduling — absolute UTC timestamps only.
 *
 * The offset concept ("1h before due", "24h before due") has been dropped.
 * Reminders are a simple list of {id, taskId, remindAt, sent}. Add one by
 * datetime, delete by id. Due date is a separate task field — if you want
 * a reminder 1h before due, compute the absolute time at creation.
 */

export async function scheduleReminder(taskId: string, remindAt: Date): Promise<string | null> {
  if (remindAt.getTime() <= Date.now()) return null;

  // Dedupe: if a pending reminder already exists at the same minute, skip.
  const existing = await db.select().from(taskReminders)
    .where(and(eq(taskReminders.taskId, taskId), eq(taskReminders.sent, false)));
  const minute = Math.floor(remindAt.getTime() / 60000);
  const dup = existing.find(r => Math.floor(r.remindAt.getTime() / 60000) === minute);
  if (dup) return dup.id;

  const [row] = await db.insert(taskReminders)
    .values({ taskId, remindAt })
    .returning({ id: taskReminders.id });
  return row.id;
}

export async function cancelReminders(taskId: string) {
  await db.delete(taskReminders)
    .where(and(
      eq(taskReminders.taskId, taskId),
      eq(taskReminders.sent, false),
    ));
}

export async function cancelReminder(reminderId: string) {
  await db.delete(taskReminders).where(eq(taskReminders.id, reminderId));
}
