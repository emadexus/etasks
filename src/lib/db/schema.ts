import { pgTable, uuid, text, timestamp, bigint, boolean, unique } from "drizzle-orm/pg-core";

export const boards = pgTable("boards", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramChatId: bigint("telegram_chat_id", { mode: "bigint" }).notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id").notNull().references(() => boards.id),
  telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).notNull(),
  username: text("username"),
  firstName: text("first_name").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
}, (table) => ({
  uniqueMember: unique().on(table.boardId, table.telegramUserId),
}));

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id").notNull().references(() => boards.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["todo", "in_progress", "done"] }).notNull().default("todo"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  assigneeId: uuid("assignee_id").references(() => members.id),
  createdBy: uuid("created_by").notNull().references(() => members.id),
  deadline: timestamp("deadline").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  authorId: uuid("author_id").notNull().references(() => members.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskReminders = pgTable("task_reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  offsetLabel: text("offset_label").notNull(),
  remindAt: timestamp("remind_at").notNull(),
  qstashMessageId: text("qstash_message_id"),
  sent: boolean("sent").notNull().default(false),
});
