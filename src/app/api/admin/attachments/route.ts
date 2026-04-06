import { NextRequest, NextResponse } from "next/server";
import { getAdminOnlyAuth } from "@/lib/telegram/auth";
import { db } from "@/lib/db";
import { taskAttachments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTaskWithDetails, getOrCreateUser } from "@/lib/db/queries";
import { uploadFile, deleteFile } from "@/lib/storage/spaces";

/**
 * Admin API: Attachment management.
 *
 * GET /api/admin/attachments?taskId=...
 * POST /api/admin/attachments (multipart: file, taskId, [fileUrl, fileName for link-only])
 * DELETE /api/admin/attachments?id=...
 */

export async function GET(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const attachments = await db.select().from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(taskAttachments.createdAt);

  return NextResponse.json(attachments);
}

export async function POST(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";

  // Support both multipart file upload and JSON link attachment
  if (contentType.includes("application/json")) {
    // Link-only attachment (no file upload)
    const body = await req.json();
    const { taskId, fileUrl, fileName } = body;

    if (!taskId || !fileUrl || !fileName) {
      return NextResponse.json({ error: "taskId, fileUrl, and fileName required" }, { status: 400 });
    }

    const taskResult = await getTaskWithDetails(taskId);
    if (!taskResult) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const adminUser = await getOrCreateUser(admin.userId, admin.username, admin.firstName);

    const [attachment] = await db.insert(taskAttachments).values({
      taskId,
      fileName,
      fileUrl,
      fileSize: null,
      mimeType: body.mimeType || null,
      uploadedById: null,
      uploadedByUserId: adminUser.id,
    }).returning();

    return NextResponse.json(attachment, { status: 201 });
  }

  // Multipart file upload
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const taskId = formData.get("taskId") as string | null;

  if (!file || !taskId) {
    return NextResponse.json({ error: "file and taskId required" }, { status: 400 });
  }

  const taskResult = await getTaskWithDetails(taskId);
  if (!taskResult) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const { url } = await uploadFile(buffer, file.name, file.type);

  const adminUser = await getOrCreateUser(admin.userId, admin.username, admin.firstName);

  const [attachment] = await db.insert(taskAttachments).values({
    taskId,
    fileName: file.name,
    fileUrl: url,
    fileSize: file.size,
    mimeType: file.type,
    uploadedById: null,
    uploadedByUserId: adminUser.id,
  }).returning();

  return NextResponse.json(attachment, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const admin = getAdminOnlyAuth(req);
  if (!admin) return NextResponse.json({ error: "Admin auth required" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await db.select().from(taskAttachments)
    .where(eq(taskAttachments.id, id))
    .limit(1);

  if (existing.length > 0 && existing[0].fileUrl.includes("digitaloceanspaces.com")) {
    const key = existing[0].fileUrl.split("/").slice(-2).join("/");
    try { await deleteFile(key); } catch (e) { console.warn("Failed to delete file from spaces:", e); }
  }

  await db.delete(taskAttachments).where(eq(taskAttachments.id, id));
  return NextResponse.json({ ok: true });
}
