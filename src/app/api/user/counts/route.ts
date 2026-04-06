import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/telegram/auth";
import { getSmartFilterCounts } from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const counts = await getSmartFilterCounts(auth.dbUserId);
  return NextResponse.json(counts);
}
