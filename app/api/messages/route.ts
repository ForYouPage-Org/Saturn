import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/auth-server";
import { q } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const me = await getCurrentParticipant();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ messages: q.listMessages.all(me.id) });
}
