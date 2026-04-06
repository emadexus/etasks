import { NextRequest, NextResponse } from "next/server";
import { getAdminOnlyAuth } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { comments, boards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCommentsForTask, getTaskWithDetails, upsertMember } from "@/lib/db/queries";
import { notifyGroup, notifyUser, formatComment } from "@/lib/telegram/notify";

/**
 * Admin API: Comment management.
 *
 * GET /api/admin/comments?taskId=...
 * POST /api/admin/comments { taskId, text, authorTelegramId, authorName, notify }
 * DELETE /api/admin/comments?commentId=...
 */

export async function GET(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const result = await getCommentsForTask(taskId);
  return NextResponse.json(result.map(r => ({
    comment: r.comment,
    author: { ...r.author, telegramUserId: r.author.telegramUserId.toString() },
  })));
}

export async function POST(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const body = await req.json();
  const { taskId, text, authorTelegramId, authorName, notify: shouldNotify } = body;

  if (!taskId || !text) {
    return NextResponse.json({ error: "taskId and text required" }, { status: 400 });
  }

  const taskResult = await getTaskWithDetails(taskId);
  if (!taskResult) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (!taskResult.task.boardId) {
    return NextResponse.json({ error: "Comments only supported for board tasks" }, { status: 400 });
  }

  // Resolve author: use provided telegram ID or admin's
  const authorTgId = BigInt(authorTelegramId || admin.userId);
  const member = await upsertMember(
    taskResult.task.boardId,
    authorTgId,
    null,
    authorName || admin.firstName,
  );

  const [comment] = await db.insert(comments).values({
    taskId,
    authorId: member.id,
    text,
  }).returning();

  // Notify if requested (default: true)
  if (shouldNotify !== false) {
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
          message,
        );
      }
    }
  }

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const commentId = req.nextUrl.searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });

  await db.delete(comments).where(eq(comments.id, commentId));
  return NextResponse.json({ ok: true });
}
