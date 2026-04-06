import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/telegram/auth";
import { getUserProjects } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { boards, members } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userProjects = await getUserProjects(auth.dbUserId);

  const userBoards = await db
    .select({ board: boards })
    .from(members)
    .innerJoin(boards, eq(members.boardId, boards.id))
    .where(and(eq(members.telegramUserId, auth.userId), isNull(members.leftAt)));

  return NextResponse.json({
    id: auth.dbUserId,
    firstName: auth.firstName,
    username: auth.username,
    projectCount: userProjects.length,
    projectLimit: 3,
    boardCount: userBoards.length,
    boardLimit: 2,
  });
}
