import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { q, toClientParticipant } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = q.listParticipants.all();
  const participants = rows.map((p) => {
    const messages = q.countMessages.get(p.id)?.n ?? 0;
    const responses = q.countResponsesByParticipant.get(p.id)?.n ?? 0;
    const lastMessage = q.lastMessageAt.get(p.id)?.created_at ?? null;
    return {
      ...toClientParticipant(p),
      stats: { messages, responses, last_message_at: lastMessage },
    };
  });
  return NextResponse.json({ participants });
}
