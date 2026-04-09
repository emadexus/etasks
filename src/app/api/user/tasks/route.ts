import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/telegram/auth";
import { getFilteredTasks } from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filter = req.nextUrl.searchParams.get("filter") || "all";
  const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
  const chatId = req.nextUrl.searchParams.get("chatId") || undefined;

  const result = await getFilteredTasks(auth.dbUserId, filter, projectId, chatId);

  // Filter out bot tasks for non-admin users
  const BOT_TG_ID = BigInt("8433233305");
  const ADMIN_TG_ID = BigInt("247463948");
  const isAdmin = auth.userId === ADMIN_TG_ID;
  const filtered = isAdmin ? result : result.filter((r) => r.assignee?.telegramUserId !== BOT_TG_ID);

  return NextResponse.json(
    filtered.map((r) => ({
      task: r.task,
      assignee: r.assignee
        ? {
            id: r.assignee.id,
            username: r.assignee.username,
            firstName: r.assignee.firstName,
            telegramUserId: r.assignee.telegramUserId.toString(),
          }
        : null,
    }))
  );
}
