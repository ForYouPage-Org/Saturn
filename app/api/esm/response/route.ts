import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/auth-server";
import { q } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const me = await getCurrentParticipant();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    surveyId?: number;
    answers?: Record<string, unknown>;
    triggeredAt?: string;
  } | null;

  if (!Number.isInteger(body?.surveyId)) {
    return NextResponse.json({ error: "surveyId must be an integer" }, { status: 400 });
  }
  if (!body?.answers || typeof body.answers !== "object") {
    return NextResponse.json({ error: "answers missing" }, { status: 400 });
  }

  q.insertEsmResponse.run({
    participant_id: me.id,
    survey_id: body.surveyId!,
    answers: JSON.stringify(body.answers),
    triggered_at: body.triggeredAt ?? null,
  });

  return NextResponse.json({ ok: true });
}
