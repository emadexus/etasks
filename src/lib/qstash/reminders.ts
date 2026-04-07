import { db } from "@/lib/db";
import { taskReminders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const OFFSET_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export async function scheduleReminders(taskId: string, deadline: Date, offsets: string[]) {
  for (const offset of offsets) {
    const ms = OFFSET_MS[offset];
    if (!ms) continue;

    const remindAt = new Date(deadline.getTime() - ms);
    if (remindAt.getTime() <= Date.now()) continue;

    await db.insert(taskReminders).values({
      taskId,
      offsetLabel: offset,
      remindAt,
    });
  }
}

export async function cancelReminders(taskId: string) {
  await db.delete(taskReminders)
    .where(and(
      eq(taskReminders.taskId, taskId),
      eq(taskReminders.sent, false),
    ));
}

export async function toggleReminder(taskId: string, offset: string, deadline: Date, enable: boolean) {
  if (enable) {
    await scheduleReminders(taskId, deadline, [offset]);
  } else {
    const reminders = await db.select().from(taskReminders)
      .where(and(
        eq(taskReminders.taskId, taskId),
        eq(taskReminders.sent, false),
      ));

    const target = reminders.find(r => r.offsetLabel === offset);
    if (target) {
      await db.delete(taskReminders).where(eq(taskReminders.id, target.id));
    }
  }
}
