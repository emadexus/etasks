import { NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
import { bot } from "@/lib/telegram/bot";
import { db } from "@/lib/db";
import { boards, members } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyGroup } from "@/lib/telegram/notify";

// Handle /start command in group or private chat
bot.command("start", async (ctx) => {
  const chat = ctx.chat;
  if (chat.type === "private") {
    await ctx.reply("Welcome to etasks! Add me to a group to create a task board.");
    return;
  }

  // In group — check if board exists, if not create it
  const existing = await db.select().from(boards)
    .where(eq(boards.telegramChatId, BigInt(chat.id)))
    .limit(1);

  if (existing.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [[
        { text: "Open Task Board", url: `https://t.me/e_task_bot/open?startapp=chat${chat.id.toString().replace("-", "n")}` }
      ]]
    };
    await ctx.reply(`Task board is ready for <b>${chat.title}</b>!`, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } else {
    // Create board on /start in group
    const [newBoard] = await db.insert(boards).values({
      telegramChatId: BigInt(chat.id),
      name: chat.title || "Untitled Board",
    }).returning();

    try {
      const admins = await bot.api.getChatAdministrators(chat.id);
      for (const admin of admins) {
        if (admin.user.is_bot) continue;
        await db.insert(members).values({
          boardId: newBoard.id,
          telegramUserId: BigInt(admin.user.id),
          username: admin.user.username || null,
          firstName: admin.user.first_name,
          role: admin.status === "creator" ? "admin" : "member",
        }).onConflictDoNothing();
      }
    } catch (e) {
      console.error("Failed to sync members:", e);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [[
        { text: "Open Task Board", url: `https://t.me/e_task_bot/open?startapp=chat${chat.id.toString().replace("-", "n")}` }
      ]]
    };
    await ctx.reply(
      `Board created for <b>${chat.title}</b>!\nStart the bot privately for personal notifications.`,
      { parse_mode: "HTML", reply_markup: keyboard }
    );
  }
});

// Handle bot being added to a group
bot.on("my_chat_member", async (ctx) => {
  const chat = ctx.chat;
  const newStatus = ctx.myChatMember.new_chat_member.status;

  if (chat.type !== "group" && chat.type !== "supergroup") return;

  if (newStatus === "member" || newStatus === "administrator") {
    const existing = await db.select().from(boards)
      .where(eq(boards.telegramChatId, BigInt(chat.id)))
      .limit(1);

    let boardId: string;
    if (existing.length > 0) {
      boardId = existing[0].id;
    } else {
      const [newBoard] = await db.insert(boards).values({
        telegramChatId: BigInt(chat.id),
        name: chat.title || "Untitled Board",
      }).returning();
      boardId = newBoard.id;
    }

    try {
      const admins = await bot.api.getChatAdministrators(chat.id);
      for (const admin of admins) {
        if (admin.user.is_bot) continue;
        await db.insert(members).values({
          boardId,
          telegramUserId: BigInt(admin.user.id),
          username: admin.user.username || null,
          firstName: admin.user.first_name,
          role: admin.status === "creator" ? "admin" : "member",
        }).onConflictDoNothing();
      }
    } catch (e) {
      console.error("Failed to sync members:", e);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [[
        { text: "Open Task Board", url: `https://t.me/e_task_bot/open?startapp=chat${chat.id.toString().replace("-", "n")}` }
      ]]
    };
    await notifyGroup(BigInt(chat.id),
      `Board created for <b>${chat.title}</b> ✨\nStart the bot privately for personal notifications.`,
      keyboard
    );
  }

  if (newStatus === "left" || newStatus === "kicked") {
    console.log("Bot removed from chat:", chat.id);
  }
});

bot.on("chat_member", async (ctx) => {
  const chat = ctx.chat;
  const member = ctx.chatMember.new_chat_member;

  if (member.user.is_bot) return;

  const board = await db.select().from(boards)
    .where(eq(boards.telegramChatId, BigInt(chat.id)))
    .limit(1);

  if (board.length === 0) return;

  if (member.status === "member" || member.status === "administrator") {
    await db.insert(members).values({
      boardId: board[0].id,
      telegramUserId: BigInt(member.user.id),
      username: member.user.username || null,
      firstName: member.user.first_name,
      role: "member",
    }).onConflictDoNothing();
  }

  if (member.status === "left" || member.status === "kicked") {
    const existing = await db.select().from(members)
      .where(eq(members.telegramUserId, BigInt(member.user.id)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(members)
        .set({ leftAt: new Date() })
        .where(eq(members.id, existing[0].id));
    }
  }
});

// Catch-all error handler
bot.catch((err) => {
  console.error("Bot error:", err.message);
  console.error("Update that caused error:", JSON.stringify(err.ctx?.update));
});

const handler = webhookCallback(bot, "std/http");

export async function POST(req: Request) {
  try {
    return await handler(req);
  } catch (e) {
    console.error("Webhook handler error:", e);
    return NextResponse.json({ ok: true });
  }
}
