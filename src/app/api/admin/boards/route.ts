import { NextRequest, NextResponse } from "next/server";
import { getAdminOnlyAuth } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { boards, members } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Admin API: Board listing and management.
 *
 * GET /api/admin/boards - list all boards with member counts
 * PATCH /api/admin/boards?boardId=... { language, name }
 */

export async function GET(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const allBoards = await db.select().from(boards);

  const result = await Promise.all(allBoards.map(async (board) => {
    const activeMembers = await db.select().from(members)
      .where(and(eq(members.boardId, board.id), isNull(members.leftAt)));
    return {
      id: board.id,
      name: board.name,
      chatId: board.telegramChatId.toString(),
      language: board.language,
      memberCount: activeMembers.length,
      members: activeMembers.map(m => ({
        id: m.id,
        telegramUserId: m.telegramUserId.toString(),
        username: m.username,
        firstName: m.firstName,
        role: m.role,
      })),
    };
  }));

  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const boardId = req.nextUrl.searchParams.get("boardId");
  if (!boardId) return NextResponse.json({ error: "boardId required" }, { status: 400 });

  const body = await req.json();
  const updates: Record<string, any> = {};
  if (body.language !== undefined) updates.language = body.language;
  if (body.name !== undefined) updates.name = body.name;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const [updated] = await db.update(boards)
    .set(updates)
    .where(eq(boards.id, boardId))
    .returning();

  return NextResponse.json(updated);
}
