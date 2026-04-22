import { db } from ".";
import { boards, members, tasks, comments, taskReminders, users, projects } from "./schema";
import { eq, and, isNull, desc, asc, or, gte, lt, sql, count } from "drizzle-orm";

// ─── User queries ───

export async function getOrCreateUser(telegramUserId: bigint, username: string | null, firstName: string) {
  const existing = await db.select().from(users)
    .where(eq(users.telegramUserId, telegramUserId))
    .limit(1);

  if (existing.length > 0) {
    const newUsername = username ?? existing[0].username;
    const newFirstName = firstName || existing[0].firstName || firstName;
    if (existing[0].username !== newUsername || existing[0].firstName !== newFirstName) {
      const [updated] = await db.update(users)
        .set({ username: newUsername, firstName: newFirstName, name: newFirstName })
        .where(eq(users.id, existing[0].id))
        .returning();
      return updated;
    }
    return existing[0];
  }

  const [user] = await db.insert(users).values({
    telegramUserId,
    username,
    firstName,
    name: firstName,
  }).returning();
  return user;
}

// ─── Board queries ───

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
    const newUsername = username ?? existing[0].username;
    const newFirstName = (firstName && firstName !== "User") ? firstName : existing[0].firstName;
    const [updated] = await db.update(members)
      .set({ username: newUsername, firstName: newFirstName, leftAt: null })
      .where(eq(members.id, existing[0].id))
      .returning();
    return updated;
  }

  // For new members, try to get name from users table if not provided
  let resolvedFirstName = firstName;
  let resolvedUsername = username;
  if (!firstName || firstName === "User") {
    const userRecord = await db.select().from(users)
      .where(eq(users.telegramUserId, telegramUserId))
      .limit(1);
    if (userRecord.length > 0) {
      resolvedFirstName = userRecord[0].firstName || userRecord[0].name;
      resolvedUsername = resolvedUsername ?? userRecord[0].username;
    } else {
      resolvedFirstName = firstName || "Unknown";
    }
  }

  const [member] = await db.insert(members).values({
    boardId,
    telegramUserId,
    username: resolvedUsername,
    firstName: resolvedFirstName,
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

// ─── Task queries ───

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

// ─── Comment queries ───

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

// ─── Reminder queries ───

export async function getRemindersForTask(taskId: string) {
  return db.select().from(taskReminders)
    .where(eq(taskReminders.taskId, taskId));
}

// ─── Project queries ───

export async function getUserProjects(userId: string) {
  return db.select().from(projects)
    .where(and(
      eq(projects.ownerId, userId),
      isNull(projects.archivedAt),
    ))
    .orderBy(asc(projects.createdAt));
}

export async function getProjectById(projectId: string) {
  const result = await db.select().from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return result[0] || null;
}

// ─── Smart filter queries ───

export async function getSmartFilterCounts(userId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const next7End = new Date(todayStart);
  next7End.setDate(next7End.getDate() + 7);

  const baseWhere = and(eq(tasks.ownerId, userId), isNull(tasks.archivedAt));
  const notDone = and(baseWhere, sql`${tasks.status} != 'done'`);

  const [allCount] = await db.select({ value: count() }).from(tasks).where(notDone);

  const [inboxCount] = await db.select({ value: count() }).from(tasks)
    .where(and(notDone, isNull(tasks.boardId), isNull(tasks.projectId)));

  const [todayCount] = await db.select({ value: count() }).from(tasks)
    .where(and(notDone, or(
      and(gte(tasks.dateDue, todayStart), lt(tasks.dateDue, tomorrowStart)),
      and(gte(tasks.datePlanned, todayStart), lt(tasks.datePlanned, tomorrowStart)),
    )));

  const [tomorrowCount] = await db.select({ value: count() }).from(tasks)
    .where(and(notDone, or(
      and(gte(tasks.dateDue, tomorrowStart), lt(tasks.dateDue, tomorrowEnd)),
      and(gte(tasks.datePlanned, tomorrowStart), lt(tasks.datePlanned, tomorrowEnd)),
    )));

  const [next7Count] = await db.select({ value: count() }).from(tasks)
    .where(and(notDone, or(
      and(gte(tasks.dateDue, todayStart), lt(tasks.dateDue, next7End)),
      and(gte(tasks.datePlanned, todayStart), lt(tasks.datePlanned, next7End)),
    )));

  const [completedCount] = await db.select({ value: count() }).from(tasks)
    .where(and(baseWhere, eq(tasks.status, "done")));

  const [archivedCount] = await db.select({ value: count() }).from(tasks)
    .where(and(eq(tasks.ownerId, userId), sql`${tasks.archivedAt} IS NOT NULL`));

  return {
    all: allCount.value,
    inbox: inboxCount.value,
    today: todayCount.value,
    tomorrow: tomorrowCount.value,
    next7days: next7Count.value,
    completed: completedCount.value,
    archived: archivedCount.value,
  };
}

export async function getFilteredTasks(userId: string, filter: string, projectId?: string, chatId?: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const next7End = new Date(todayStart);
  next7End.setDate(next7End.getDate() + 7);

  const baseWhere = and(eq(tasks.ownerId, userId), isNull(tasks.archivedAt));

  let whereClause;

  if (projectId) {
    whereClause = and(baseWhere, eq(tasks.projectId, projectId), sql`${tasks.status} != 'done'`);
  } else if (chatId) {
    const board = await getBoardByChatId(BigInt(chatId));
    if (!board) return [];
    whereClause = and(baseWhere, eq(tasks.boardId, board.id), sql`${tasks.status} != 'done'`);
  } else {
    switch (filter) {
      case "inbox":
        whereClause = and(baseWhere, isNull(tasks.boardId), isNull(tasks.projectId), sql`${tasks.status} != 'done'`);
        break;
      case "today":
        whereClause = and(baseWhere, sql`${tasks.status} != 'done'`, or(
          and(gte(tasks.dateDue, todayStart), lt(tasks.dateDue, tomorrowStart)),
          and(gte(tasks.datePlanned, todayStart), lt(tasks.datePlanned, tomorrowStart)),
        ));
        break;
      case "tomorrow":
        whereClause = and(baseWhere, sql`${tasks.status} != 'done'`, or(
          and(gte(tasks.dateDue, tomorrowStart), lt(tasks.dateDue, tomorrowEnd)),
          and(gte(tasks.datePlanned, tomorrowStart), lt(tasks.datePlanned, tomorrowEnd)),
        ));
        break;
      case "next7days":
        whereClause = and(baseWhere, sql`${tasks.status} != 'done'`, or(
          and(gte(tasks.dateDue, todayStart), lt(tasks.dateDue, next7End)),
          and(gte(tasks.datePlanned, todayStart), lt(tasks.datePlanned, next7End)),
        ));
        break;
      case "completed":
        whereClause = and(baseWhere, eq(tasks.status, "done"));
        break;
      case "archived":
        whereClause = and(eq(tasks.ownerId, userId), sql`${tasks.archivedAt} IS NOT NULL`);
        break;
      default: // "all"
        whereClause = and(baseWhere, sql`${tasks.status} != 'done'`);
        break;
    }
  }

  const result = await db.select({
    task: tasks,
    assignee: members,
  })
    .from(tasks)
    .leftJoin(members, eq(tasks.assigneeId, members.id))
    .where(whereClause)
    .orderBy(filter === "completed" ? desc(tasks.completedAt) : filter === "archived" ? desc(tasks.archivedAt) : desc(tasks.createdAt));

  return result;
}
