import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/auth-server";
import { q, nowIso, logEvent, type EsmQuestion } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const me = await getCurrentParticipant();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const row = q.nextPendingAssignment.get(me.id, nowIso());
  if (!row) return NextResponse.json({ assignment: null });

  // Fire one shown-event per assignment (idempotent enough — we only emit
  // when the modal mounts, which happens at most a few times per session).
  logEvent({
    participantId: me.id,
    kind: "survey_shown",
    meta: { assignment_id: row.id, survey_id: row.survey_id, slug: row.slug },
  });

  return NextResponse.json({
    assignment: {
      id: row.id,
      surveyId: row.survey_id,
      assignedAt: row.assigned_at,
      availableAt: row.available_at,
      dueAt: row.due_at,
      required: row.required === 1,
      seriesId: row.series_id,
      occurrenceN: row.occurrence_n,
      survey: {
        id: row.survey_id,
        slug: row.slug,
        title: row.title,
        category: row.category,
        description: row.description,
        instructions: row.instructions,
        questions: JSON.parse(row.questions) as EsmQuestion[],
      },
    },
  });
}
