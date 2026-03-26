import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/telegram/auth";
import { getBoardByChatId, getActiveMembers, upsertMember } from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  const board = await getBoardByChatId(BigInt(chatId));
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  await upsertMember(board.id, auth.userId, auth.username, auth.firstName);

  const membersList = await getActiveMembers(board.id);
  // Convert BigInt fields to strings for JSON serialization
  return NextResponse.json(membersList.map(m => ({
    ...m,
    telegramUserId: m.telegramUserId.toString(),
  })));
}
