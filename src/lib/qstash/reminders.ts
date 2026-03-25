import { Client } from "@upstash/qstash";
import { db } from "@/lib/db";
import { taskReminders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  for (const offset of offsets) {
    const ms = OFFSET_MS[offset];
    if (!ms) continue;

    const remindAt = new Date(deadline.getTime() - ms);
    if (remindAt.getTime() <= Date.now()) continue;

    const [reminder] = await db.insert(taskReminders).values({
      taskId,
      offsetLabel: offset,
      remindAt,
    }).returning();

    try {
      const result = await qstash.publishJSON({
        url: `${appUrl}/api/notify/deadline`,
        body: { taskId, reminderId: reminder.id },
        notBefore: Math.floor(remindAt.getTime() / 1000),
      });

      await db.update(taskReminders)
        .set({ qstashMessageId: result.messageId })
        .where(eq(taskReminders.id, reminder.id));
    } catch (e) {
      console.error("Failed to schedule QStash reminder:", e);
    }
  }
}

export async function cancelReminders(taskId: string) {
  const reminders = await db.select().from(taskReminders)
    .where(and(
      eq(taskReminders.taskId, taskId),
      eq(taskReminders.sent, false),
    ));

  for (const reminder of reminders) {
    if (reminder.qstashMessageId) {
      try {
        await qstash.messages.delete(reminder.qstashMessageId);
      } catch (e) {
        console.warn("Failed to cancel QStash message:", reminder.qstashMessageId, e);
      }
    }
  }

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
    if (target?.qstashMessageId) {
      try {
        await qstash.messages.delete(target.qstashMessageId);
      } catch (e) {
        console.warn("Failed to cancel reminder:", e);
      }
    }
    if (target) {
      await db.delete(taskReminders).where(eq(taskReminders.id, target.id));
    }
  }
}
