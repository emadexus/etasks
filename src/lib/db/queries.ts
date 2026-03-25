import { db } from ".";
import { boards, members, tasks, comments, taskReminders } from "./schema";
import { eq, and, isNull, desc, asc } from "drizzle-orm";

export async function getBoardByChatId(chatId: bigint) {
  const result = await db.select().from(boards)
    .where(eq(boards.telegramChatId, chatId))
    .limit(1);
  return result[0] || null;
}

export async function getMemberByTelegramId(boardId: string, telegramUserId: bigint) {
  const result = await db.select().from(members)
    .where(and(
      eq(members.boardId, boardId),
      eq(members.telegramUserId, telegramUserId),
      isNull(members.leftAt),
    ))
    .limit(1);
  return result[0] || null;
}

export async function upsertMember(boardId: string, telegramUserId: bigint, username: string | null, firstName: string) {
  const existing = await db.select().from(members)
    .where(and(
      eq(members.boardId, boardId),
      eq(members.telegramUserId, telegramUserId),
    ))
    .limit(1);

  if (existing.length > 0) {
    await db.update(members)
      .set({ username, firstName, leftAt: null })
      .where(eq(members.id, existing[0].id));
    return existing[0];
  }

  const [member] = await db.insert(members).values({
    boardId,
    telegramUserId,
    username,
    firstName,
  }).returning();
  return member;
}

export async function getActiveMembers(boardId: string) {
  return db.select().from(members)
    .where(and(
      eq(members.boardId, boardId),
      isNull(members.leftAt),
    ));
}

export async function getTaskWithDetails(taskId: string) {
  const result = await db.select({
    task: tasks,
    assignee: members,
  })
    .from(tasks)
    .leftJoin(members, eq(tasks.assigneeId, members.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return result[0] || null;
}

export async function getCommentsForTask(taskId: string) {
  return db.select({
    comment: comments,
    author: members,
  })
    .from(comments)
    .innerJoin(members, eq(comments.authorId, members.id))
    .where(eq(comments.taskId, taskId))
    .orderBy(asc(comments.createdAt));
}

export async function getRemindersForTask(taskId: string) {
  return db.select().from(taskReminders)
    .where(eq(taskReminders.taskId, taskId));
}
