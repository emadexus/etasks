import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { scheduleReminders } from "@/lib/qstash/reminders";

interface RecurrenceRule {
  type: "daily" | "weekly" | "monthly" | "yearly";
  interval: number; // e.g., every 2 days
}

export function parseRecurrenceRule(rule: string): RecurrenceRule | null {
  try {
    const parsed = JSON.parse(rule);
    if (!parsed.type || !parsed.interval) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getNextOccurrence(rule: RecurrenceRule, fromDate: Date): Date {
  const next = new Date(fromDate);
  switch (rule.type) {
    case "daily":
      next.setDate(next.getDate() + rule.interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7 * rule.interval);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + rule.interval);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + rule.interval);
      break;
  }
  return next;
}

/** Creates the next recurrence of a task when it's completed. */
export async function createNextRecurrence(completedTask: typeof tasks.$inferSelect) {
  const rule = parseRecurrenceRule(completedTask.recurrenceRule!);
  if (!rule) return null;

  const now = new Date();
  const nextDue = completedTask.dateDue ? getNextOccurrence(rule, completedTask.dateDue) : null;
  const nextPlanned = completedTask.datePlanned ? getNextOccurrence(rule, completedTask.datePlanned) : null;

  const [newTask] = await db.insert(tasks).values({
    boardId: completedTask.boardId,
    ownerId: completedTask.ownerId,
    projectId: completedTask.projectId,
    title: completedTask.title,
    description: completedTask.description,
    status: "todo",
    priority: completedTask.priority,
    assigneeId: completedTask.assigneeId,
    createdBy: completedTask.createdBy,
    dateDue: nextDue,
    datePlanned: nextPlanned,
    recurrenceRule: completedTask.recurrenceRule,
    completedAt: null,
  }).returning();

  if (nextDue) {
    await scheduleReminders(newTask.id, nextDue, ["24h"]);
  }

  return newTask;
}
