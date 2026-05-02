import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/auth-server";
import { q, nowIso, logEvent } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const me = await getCurrentParticipant();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    surveyId?: number;
    assignmentId?: number;
    answers?: Record<string, unknown>;
    triggeredAt?: string;
  } | null;

  if (!Number.isInteger(body?.surveyId)) {
    return NextResponse.json({ error: "surveyId must be an integer" }, { status: 400 });
  }
  if (!body?.answers || typeof body.answers !== "object") {
    return NextResponse.json({ error: "answers missing" }, { status: 400 });
  }

  // If assignmentId is provided, verify it belongs to this participant +
  // matches surveyId, otherwise reject (don't let clients close arbitrary
  // assignments).
  let assignmentId: number | null = null;
  if (Number.isInteger(body.assignmentId)) {
    const a = q.getAssignmentById.get(body.assignmentId!);
    if (!a || a.participant_id !== me.id || a.survey_id !== body.surveyId) {
      return NextResponse.json({ error: "bad assignment" }, { status: 400 });
    }
    if (a.status !== "pending") {
      return NextResponse.json({ error: "assignment already closed" }, { status: 409 });
    }
    assignmentId = a.id;
  }

  const inserted = q.insertEsmResponse.get({
    participant_id: me.id,
    survey_id: body.surveyId!,
    assignment_id: assignmentId,
    answers: JSON.stringify(body.answers),
    triggered_at: body.triggeredAt ?? null,
  });

  if (assignmentId && inserted) {
    q.completeAssignment.run({
      id: assignmentId,
      response_id: inserted.id,
      completed_at: nowIso(),
    });
  }

  logEvent({
    participantId: me.id,
    kind: "survey_completed",
    meta: {
      survey_id: body.surveyId,
      assignment_id: assignmentId,
      response_id: inserted?.id,
    },
  });

  return NextResponse.json({ ok: true, responseId: inserted?.id });
}
