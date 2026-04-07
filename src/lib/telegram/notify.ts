import { bot } from "./bot";
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove, ForceReply } from "grammy/types";

type ReplyMarkup = InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;

// Bot-side notification translations
const botStrings = {
  en: {
    newTask: "New task",
    commentedOn: "commented on",
    deadlineReminder: "Deadline reminder",
    dueIn: "Due in",
    commentAdded: "Comment added to",
    boardCreated: "Board created for",
    boardReady: "Task board is ready for",
    openTaskBoard: "Open Task Board",
    openTask: "Open Task",
    startPrivate: "Start the bot privately for personal notifications.",
    welcome: "Welcome to etasks! Add me to a group to create a task board.",
    langSet: "Language set to",
    langRu: "Russian",
    langEn: "English",
  },
  ru: {
    newTask: "Новая задача",
    commentedOn: "прокомментировал(а)",
    deadlineReminder: "Напоминание о дедлайне",
    dueIn: "Осталось",
    commentAdded: "Комментарий к задаче",
    boardCreated: "Доска создана для",
    boardReady: "Доска задач готова для",
    openTaskBoard: "Открыть доску",
    openTask: "Открыть задачу",
    startPrivate: "Напишите боту лично для персональных уведомлений.",
    welcome: "Добро пожаловать в etasks! Добавьте меня в группу для создания доски задач.",
    langSet: "Язык установлен:",
    langRu: "Русский",
    langEn: "Английский",
  },
} as const;

type BotStringKey = keyof typeof botStrings.en;

export function botT(key: BotStringKey, lang: string = "en"): string {
  const locale = lang in botStrings ? lang as keyof typeof botStrings : "en";
  return botStrings[locale][key] || botStrings.en[key];
}

export async function notifyGroup(chatId: bigint, text: string, replyMarkup?: ReplyMarkup) {
  try {
    await bot.api.sendMessage(chatId.toString(), text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  } catch (e) {
    console.error("Failed to send group message:", e);
  }
}

export async function notifyUser(userId: bigint, text: string) {
  try {
    await bot.api.sendMessage(userId.toString(), text, { parse_mode: "HTML" });
  } catch (e) {
    console.warn("Failed to DM user:", userId.toString(), e);
  }
}

export function formatNewTask(taskId: string, title: string, priority: string, assigneeUsername: string | null, deadline: Date | null, lang: string = "en") {
  const linked = taskLink(taskId, title);
  const assignee = assigneeUsername ? `@${assigneeUsername}` : (lang === "ru" ? "не назначен" : "unassigned");
  const due = deadline
    ? deadline.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month: "short", day: "numeric" })
    : "";
  const dueStr = due ? ` · ${lang === "ru" ? "до" : "due"} ${due}` : "";
  return `<b>${botT("newTask", lang)}</b>\n${linked}\n● ${priority} · ${assignee}${dueStr}`;
}

export function formatComment(taskId: string, authorName: string, taskTitle: string, commentText: string, lang: string = "en") {
  const linked = taskLink(taskId, taskTitle);
  const preview = commentText.length > 100 ? commentText.slice(0, 100) + "..." : commentText;
  return `<b>${authorName}</b> ${botT("commentedOn", lang)} <b>${linked}</b>\n<i>"${preview}"</i>`;
}

function taskLink(taskId: string, title: string): string {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "e_task_bot";
  return `<a href="https://t.me/${botUsername}/open?startapp=task${taskId}">${title}</a>`;
}

export function formatAssigneeChanged(taskId: string, taskTitle: string, assigneeName: string | null, changedByName: string, lang: string = "en") {
  const linked = taskLink(taskId, taskTitle);
  if (assigneeName) {
    const msg = lang === "ru" ? `назначена на <b>${assigneeName}</b>` : `assigned to <b>${assigneeName}</b>`;
    return `📋 <b>${linked}</b>\n${msg}\n<i>${lang === "ru" ? "от" : "by"} ${changedByName}</i>`;
  }
  const msg = lang === "ru" ? "снято назначение" : "unassigned";
  return `📋 <b>${linked}</b>\n${msg}\n<i>${lang === "ru" ? "от" : "by"} ${changedByName}</i>`;
}

export function formatDeadlineReminder(taskId: string, taskTitle: string, timeLeft: string, assigneeUsername: string | null, lang: string = "en") {
  const linked = taskLink(taskId, taskTitle);
  const assignee = assigneeUsername ? `@${assigneeUsername}` : "";
  return `⏰ <b>${botT("deadlineReminder", lang)}</b>\n${linked}\n${botT("dueIn", lang)} ${timeLeft} ${assignee}`;
}
