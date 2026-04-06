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

  return NextResponse.json(
    result.map((r) => ({
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
