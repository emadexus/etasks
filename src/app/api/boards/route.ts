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
      language: r.board.language,
    }))
  );
}

export async function PATCH(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { boardId, language } = body;
  if (!boardId) return NextResponse.json({ error: "boardId required" }, { status: 400 });

  // Check user is a member of this board
  const member = await db.select().from(members)
    .where(and(eq(members.boardId, boardId), eq(members.telegramUserId, auth.userId), isNull(members.leftAt)))
    .limit(1);

  if (!member[0]) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const updates: Record<string, any> = {};
  if (language !== undefined) updates.language = language;

  const [updated] = await db.update(boards).set(updates).where(eq(boards.id, boardId)).returning();
  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    language: updated.language,
    chatId: updated.telegramChatId.toString(),
  });
}
