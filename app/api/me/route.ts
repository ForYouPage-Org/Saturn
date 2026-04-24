import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/auth-server";
import { toClientParticipant } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const p = await getCurrentParticipant();
  if (!p) return NextResponse.json({ participant: null });
  return NextResponse.json({ participant: toClientParticipant(p) });
}
