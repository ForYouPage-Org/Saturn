import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    participants: q.countParticipants.get()?.n ?? 0,
    surveys: q.countSurveys.get()?.n ?? 0,
    pending_assignments: q.countPendingAssignments.get()?.n ?? 0,
    completed_responses: q.countCompletedResponses.get()?.n ?? 0,
    total_messages: q.totalMessages.get()?.n ?? 0,
  });
}
