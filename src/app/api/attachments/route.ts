import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { taskAttachments, tasks, members } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTaskWithDetails, getMemberByTelegramId } from "@/lib/db/queries";
import { uploadFile } from "@/lib/storage/spaces";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const attachments = await db.select().from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(taskAttachments.createdAt);

  return NextResponse.json(attachments);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const taskId = formData.get("taskId") as string | null;

  if (!file || !taskId) {
    return NextResponse.json({ error: "file and taskId required" }, { status: 400 });
  }

  const taskResult = await getTaskWithDetails(taskId);
  if (!taskResult) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  let memberId: string | null = null;
  if (taskResult.task.boardId) {
    const member = await getMemberByTelegramId(taskResult.task.boardId, auth.userId);
    if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });
    memberId = member.id;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { url } = await uploadFile(buffer, file.name, file.type);

  const [attachment] = await db.insert(taskAttachments).values({
    taskId,
    fileName: file.name,
    fileUrl: url,
    fileSize: file.size,
    mimeType: file.type,
    uploadedById: memberId,
    uploadedByUserId: auth.dbUserId,
  }).returning();

  return NextResponse.json(attachment, { status: 201 });
}
