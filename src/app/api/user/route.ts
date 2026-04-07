import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/telegram/auth";
import { getUserProjects } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { boards, members, users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [userRow] = await db.select().from(users).where(eq(users.id, auth.dbUserId)).limit(1);
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
    language: userRow?.language || "en",
    projectCount: userProjects.length,
    projectLimit: 3,
    boardCount: userBoards.length,
    boardLimit: 2,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, any> = {};
  if (body.language !== undefined) updates.language = body.language;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const [updated] = await db.update(users)
    .set(updates)
    .where(eq(users.id, auth.dbUserId))
    .returning();

  return NextResponse.json({ ok: true, language: updated.language });
}
