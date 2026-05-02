import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { q, toClientParticipant } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const p = q.getParticipantById.get(id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

  const messages = q.listMessages.all(id);
  const responses = q.listResponsesByParticipant.all(id).map((r) => ({
    ...r,
    answers: JSON.parse(r.answers) as Record<string, unknown>,
  }));
  const assignments = q.listAssignmentsByParticipant.all(id);
  const events = q.eventsByParticipant.all(id, 200).map((e) => ({
    ...e,
    meta: e.meta ? (JSON.parse(e.meta) as Record<string, unknown>) : null,
  }));

  return NextResponse.json({
    participant: toClientParticipant(p),
    messages,
    responses,
    assignments,
    events,
  });
}
