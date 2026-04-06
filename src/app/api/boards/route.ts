import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { boards, members } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db
    .select({
      board: boards,
      member: members,
    })
    .from(members)
    .innerJoin(boards, eq(members.boardId, boards.id))
    .where(
      and(
        eq(members.telegramUserId, auth.userId),
        isNull(members.leftAt)
      )
    );

  return NextResponse.json(
    result.map((r) => ({
      id: r.board.id,
      name: r.board.name,
      chatId: r.board.telegramChatId.toString(),
      photoUrl: r.board.photoUrl || null,
    }))
  );
}
