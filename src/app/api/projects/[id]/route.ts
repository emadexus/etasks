import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/telegram/auth";
import { getProjectById } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectById(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.ownerId !== auth.dbUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectById(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.ownerId !== auth.dbUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.color !== undefined) updates.color = body.color;
  if (body.icon !== undefined) updates.icon = body.icon;

  const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProjectById(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.ownerId !== auth.dbUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Soft-delete by setting archivedAt
  const [updated] = await db.update(projects)
    .set({ archivedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  return NextResponse.json({ ok: true });
}
