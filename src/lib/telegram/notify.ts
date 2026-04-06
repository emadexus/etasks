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

export function formatNewTask(title: string, priority: string, assigneeUsername: string | null, deadline: Date | null, lang: string = "en") {
  const assignee = assigneeUsername ? `@${assigneeUsername}` : (lang === "ru" ? "не назначен" : "unassigned");
  const due = deadline
    ? deadline.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month: "short", day: "numeric" })
    : "";
  const dueStr = due ? ` · ${lang === "ru" ? "до" : "due"} ${due}` : "";
  return `<b>${botT("newTask", lang)}</b>\n${title}\n● ${priority} · ${assignee}${dueStr}`;
}

export function formatComment(authorName: string, taskTitle: string, commentText: string, lang: string = "en") {
  const preview = commentText.length > 100 ? commentText.slice(0, 100) + "..." : commentText;
  return `<b>${authorName}</b> ${botT("commentedOn", lang)} <b>${taskTitle}</b>\n<i>"${preview}"</i>`;
}

export function formatDeadlineReminder(taskTitle: string, timeLeft: string, assigneeUsername: string | null, lang: string = "en") {
  const assignee = assigneeUsername ? `@${assigneeUsername}` : "";
  return `⏰ <b>${botT("deadlineReminder", lang)}</b>\n${taskTitle}\n${botT("dueIn", lang)} ${timeLeft} ${assignee}`;
}
