import { pgTable, uuid, text, timestamp, bigint, boolean, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("uuid").defaultRandom().primaryKey(),
  telegramUserId: bigint("telegram_id", { mode: "bigint" }).notNull().unique(),
  name: text("name").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  language: text("language").notNull().default("en"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const boards = pgTable("boards", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramChatId: bigint("telegram_chat_id", { mode: "bigint" }).notNull().unique(),
  name: text("name").notNull(),
  language: text("language").notNull().default("en"),
  photoUrl: text("photo_url"),
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

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  color: text("color"),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  archivedAt: timestamp("archived_at"),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id").references(() => boards.id),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  projectId: uuid("project_id").references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["todo", "in_progress", "done"] }).notNull().default("todo"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  assigneeId: uuid("assignee_id").references(() => members.id),
  createdBy: uuid("created_by").references(() => members.id),
  dateDue: timestamp("date_due"),
  datePlanned: timestamp("date_planned"),
  /** @deprecated Kept for DB compat; no longer used in API or UI */
  notifyAt: timestamp("notify_at"),
  recurrenceRule: text("recurrence_rule"),
  tags: text("tags"),
  checklist: text("checklist"),
  createdVia: text("created_via"),
  archivedAt: timestamp("archived_at"),
  completedAt: timestamp("completed_at"),
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

export const taskAttachments = pgTable("task_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: bigint("file_size", { mode: "number" }),
  mimeType: text("mime_type"),
  uploadedById: uuid("uploaded_by_id").references(() => members.id),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskReminders = pgTable("task_reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  /** @deprecated no longer the scheduling primitive; may be null for new rows */
  offsetLabel: text("offset_label"),
  remindAt: timestamp("remind_at").notNull(),
  /** @deprecated kept for DB compat, no longer used */
  qstashMessageId: text("qstash_message_id"),
  sent: boolean("sent").notNull().default(false),
});
