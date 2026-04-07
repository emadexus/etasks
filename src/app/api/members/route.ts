import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/telegram/auth";
import { getBoardByChatId, getActiveMembers, upsertMember } from "@/lib/db/queries";
import { bot } from "@/lib/telegram/bot";

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  const board = await getBoardByChatId(BigInt(chatId));
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  await upsertMember(board.id, auth.userId, auth.username, auth.firstName);

  const membersList = await getActiveMembers(board.id);

  // Refresh member info from Telegram in the background
  // Don't block the response — fire and forget
  syncMembersFromTelegram(BigInt(chatId), board.id, membersList).catch(e =>
    console.error("[members] Telegram sync failed:", e)
  );

  return NextResponse.json(membersList.map(m => ({
    ...m,
    telegramUserId: m.telegramUserId.toString(),
  })));
}

async function syncMembersFromTelegram(chatId: bigint, boardId: string, members: any[]) {
  for (const m of members) {
    try {
      const chatMember = await bot.api.getChatMember(Number(chatId), Number(m.telegramUserId));
      const user = chatMember.user;
      if (user && !user.is_bot) {
        const newFirstName = user.first_name;
        const newUsername = user.username || null;
        // Only update if something changed
        if (m.firstName !== newFirstName || m.username !== newUsername) {
          await upsertMember(boardId, BigInt(user.id), newUsername, newFirstName);
        }
      }
    } catch {
      // User may have left the chat — ignore
    }
  }
}
