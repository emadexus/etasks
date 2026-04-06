import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/telegram/auth";
import { getUserProjects, getSmartFilterCounts } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { boards, members } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

/** Combined endpoint: returns user profile, counts, boards, and projects in one request. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Run all queries in parallel
  const [userProjects, counts, userBoards] = await Promise.all([
    getUserProjects(auth.dbUserId),
    getSmartFilterCounts(auth.dbUserId),
    db.select({ board: boards })
      .from(members)
      .innerJoin(boards, eq(members.boardId, boards.id))
      .where(and(eq(members.telegramUserId, auth.userId), isNull(members.leftAt))),
  ]);

  return NextResponse.json({
    user: {
      id: auth.dbUserId,
      firstName: auth.firstName,
      username: auth.username,
      projectCount: userProjects.length,
      projectLimit: 3,
      boardCount: userBoards.length,
      boardLimit: 2,
    },
    counts,
    boards: userBoards.map((r) => ({
      id: r.board.id,
      name: r.board.name,
      chatId: r.board.telegramChatId.toString(),
      photoUrl: r.board.photoUrl || null,
    })),
    projects: userProjects,
  });
}
