import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { comments, boards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCommentsForTask, getMemberByTelegramId, getTaskWithDetails } from "@/lib/db/queries";
import { notifyGroup, notifyUser, formatComment } from "@/lib/telegram/notify";

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const result = await getCommentsForTask(taskId);
  return NextResponse.json(result.map(r => ({
    comment: r.comment,
    author: { ...r.author, telegramUserId: r.author.telegramUserId.toString() },
  })));
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { taskId, text } = body;

  if (!taskId || !text) {
    return NextResponse.json({ error: "taskId and text required" }, { status: 400 });
  }

  const taskResult = await getTaskWithDetails(taskId);
  if (!taskResult) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (taskResult.task.boardId) {
    const member = await getMemberByTelegramId(taskResult.task.boardId, auth.userId);
    if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

    const [comment] = await db.insert(comments).values({
      taskId,
      authorId: member.id,
      text,
    }).returning();

    const board = await db.select().from(boards)
      .where(eq(boards.id, taskResult.task.boardId))
      .limit(1);

    if (board[0]) {
      const lang = board[0].language || "en";
      const message = formatComment(member.firstName, taskResult.task.title, text, lang);
      await notifyGroup(board[0].telegramChatId, message);

      if (taskResult.assignee && taskResult.assignee.id !== member.id) {
        await notifyUser(
          (taskResult.assignee as any).telegramUserId,
          message
        );
      }
    }

    return NextResponse.json(comment, { status: 201 });
  }

  return NextResponse.json({ error: "Comments not supported for personal tasks" }, { status: 400 });
}
