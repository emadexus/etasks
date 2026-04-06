import { NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
import { bot } from "@/lib/telegram/bot";
import { db } from "@/lib/db";
import { boards, members, tasks, comments } from "@/lib/db/schema";
import { eq, and, like } from "drizzle-orm";
import { notifyGroup, botT } from "@/lib/telegram/notify";
import { upsertMember } from "@/lib/db/queries";

function boardKeyboard(chatId: number | bigint, lang: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: botT("openTaskBoard", lang), url: `https://t.me/e_task_bot/open?startapp=chat${chatId.toString().replace("-", "n")}` }
    ]]
  };
}

// Handle /start command in group or private chat
bot.command("start", async (ctx) => {
  const chat = ctx.chat;
  if (chat.type === "private") {
    const userLang = ctx.from?.language_code || "en";
    await ctx.reply(botT("welcome", userLang));
    return;
  }

  const existing = await db.select().from(boards)
    .where(eq(boards.telegramChatId, BigInt(chat.id)))
    .limit(1);

  if (existing.length > 0) {
    const lang = existing[0].language || "en";
    await ctx.reply(`${botT("boardReady", lang)} <b>${chat.title}</b>!`, {
      parse_mode: "HTML",
      reply_markup: boardKeyboard(chat.id, lang),
    });
  } else {
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
        }).onConflictDoUpdate({
          target: [members.boardId, members.telegramUserId],
          set: { username: admin.user.username || null, firstName: admin.user.first_name, leftAt: null },
        });
      }
    } catch (e) {
      console.error("Failed to sync admins:", e);
    }

    const sender = ctx.from;
    if (sender && !sender.is_bot) {
      try {
        await upsertMember(newBoard.id, BigInt(sender.id), sender.username || null, sender.first_name);
      } catch (e) {
        console.error("Failed to sync /start sender as member:", e);
      }
    }

    const lang = newBoard.language || "en";
    await ctx.reply(
      `${botT("boardCreated", lang)} <b>${chat.title}</b>!\n${botT("startPrivate", lang)}`,
      { parse_mode: "HTML", reply_markup: boardKeyboard(chat.id, lang) }
    );
  }
});

// Handle /lang command to set group language
bot.command("lang", async (ctx) => {
  const chat = ctx.chat;
  if (chat.type !== "group" && chat.type !== "supergroup") {
    await ctx.reply("This command works in groups only.");
    return;
  }

  // Check sender is admin
  const sender = ctx.from;
  if (!sender) return;
  try {
    const chatMember = await bot.api.getChatMember(chat.id, sender.id);
    if (chatMember.status !== "creator" && chatMember.status !== "administrator") {
      await ctx.reply("Only group admins can change the language.");
      return;
    }
  } catch {
    return;
  }

  const arg = ctx.match?.trim().toLowerCase();
  if (!arg || !["ru", "en"].includes(arg)) {
    await ctx.reply("Usage: /lang ru or /lang en");
    return;
  }

  const board = await db.select().from(boards)
    .where(eq(boards.telegramChatId, BigInt(chat.id)))
    .limit(1);

  if (board.length === 0) {
    await ctx.reply("No board found. Use /start first.");
    return;
  }

  await db.update(boards)
    .set({ language: arg })
    .where(eq(boards.id, board[0].id));

  const langName = arg === "ru" ? botT("langRu", arg) : botT("langEn", arg);
  await ctx.reply(`${botT("langSet", arg)} ${langName}`);
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
    let lang = "en";
    if (existing.length > 0) {
      boardId = existing[0].id;
      lang = existing[0].language || "en";
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
        }).onConflictDoUpdate({
          target: [members.boardId, members.telegramUserId],
          set: { username: admin.user.username || null, firstName: admin.user.first_name, leftAt: null },
        });
      }
    } catch (e) {
      console.error("Failed to sync members:", e);
    }

    await notifyGroup(BigInt(chat.id),
      `${botT("boardCreated", lang)} <b>${chat.title}</b> ✨\n${botT("startPrivate", lang)}`,
      boardKeyboard(chat.id, lang)
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
    }).onConflictDoUpdate({
      target: [members.boardId, members.telegramUserId],
      set: { username: member.user.username || null, firstName: member.user.first_name, leftAt: null },
    });
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

// Handle replies to bot messages as task comments
bot.on("message:text", async (ctx) => {
  const reply = ctx.message.reply_to_message;
  if (!reply || !reply.from?.is_bot) return;

  const chat = ctx.chat;
  if (chat.type !== "group" && chat.type !== "supergroup") return;

  const sender = ctx.from;
  if (!sender || sender.is_bot) return;

  const boardResult = await db.select().from(boards)
    .where(eq(boards.telegramChatId, BigInt(chat.id)))
    .limit(1);
  if (boardResult.length === 0) return;
  const boardRow = boardResult[0];
  const lang = boardRow.language || "en";

  const botText = reply.text || "";
  let matchedTask: typeof tasks.$inferSelect | null = null;

  // Try "New task\n{title}" or "Новая задача\n{title}" format
  const newTaskMatch = botText.match(/^(?:New task|Новая задача)\n(.+)/m);
  if (newTaskMatch) {
    const titleCandidate = newTaskMatch[1].trim();
    const found = await db.select().from(tasks)
      .where(and(eq(tasks.boardId, boardRow.id), like(tasks.title, titleCandidate)))
      .limit(1);
    if (found.length > 0) matchedTask = found[0];
  }

  // Try "commented on {title}" or "прокомментировал(а) {title}" format
  if (!matchedTask) {
    const commentMatch = botText.match(/(?:commented on|прокомментировал\(а\))\s+([\s\S]+?)\n/);
    if (commentMatch) {
      const titleCandidate = commentMatch[1].replace(/<[^>]+>/g, "").trim();
      const found = await db.select().from(tasks)
        .where(and(eq(tasks.boardId, boardRow.id), like(tasks.title, titleCandidate)))
        .limit(1);
      if (found.length > 0) matchedTask = found[0];
    }
  }

  if (!matchedTask) return;

  try {
    const authorMember = await upsertMember(boardRow.id, BigInt(sender.id), sender.username || null, sender.first_name);
    await db.insert(comments).values({
      taskId: matchedTask.id,
      authorId: authorMember.id,
      text: ctx.message.text,
    });
    await ctx.reply(`${botT("commentAdded", lang)} "${matchedTask.title}".`, {
      reply_parameters: { message_id: ctx.message.message_id },
    });
  } catch (e) {
    console.error("Failed to add reply as comment:", e);
  }
});

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
