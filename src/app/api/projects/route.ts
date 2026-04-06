import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/telegram/auth";
import { getUserProjects } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getUserProjects(auth.dbUserId);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await getUserProjects(auth.dbUserId);
  if (existing.length >= 3) {
    return NextResponse.json({ error: "Project limit reached (3)" }, { status: 403 });
  }

  const body = await req.json();
  const { name, color, icon } = body;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const [project] = await db.insert(projects).values({
    ownerId: auth.dbUserId,
    name,
    color: color || null,
    icon: icon || null,
  }).returning();

  return NextResponse.json(project, { status: 201 });
}
