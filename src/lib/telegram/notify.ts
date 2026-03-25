import { bot } from "./bot";
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove, ForceReply } from "grammy/types";

type ReplyMarkup = InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;

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

export function formatNewTask(title: string, priority: string, assigneeUsername: string | null, deadline: Date) {
  const assignee = assigneeUsername ? `@${assigneeUsername}` : "unassigned";
  const due = deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `<b>New task</b>\n${title}\n● ${priority} · ${assignee} · due ${due}`;
}

export function formatComment(authorName: string, taskTitle: string, commentText: string) {
  const preview = commentText.length > 100 ? commentText.slice(0, 100) + "..." : commentText;
  return `<b>${authorName}</b> commented on <b>${taskTitle}</b>\n<i>"${preview}"</i>`;
}

export function formatDeadlineReminder(taskTitle: string, timeLeft: string, assigneeUsername: string | null) {
  const assignee = assigneeUsername ? `@${assigneeUsername}` : "";
  return `⏰ <b>Deadline reminder</b>\n${taskTitle}\nDue in ${timeLeft} ${assignee}`;
}
