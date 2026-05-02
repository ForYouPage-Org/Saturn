import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isAdminRequest } from "@/lib/admin-auth";
import { db, q, logEvent } from "@/lib/db";

export const runtime = "nodejs";

// Deploys a survey to a list of participants. Body schema:
//
// {
//   participantIds: number[] | "all",   // who gets it
//   required: boolean,                   // if true, locks chat until completed
//   schedule: {
//     kind: "now" | "at" | "series",
//     // "at": single occurrence at a specific time
//     availableAt?: string,              // ISO date
//     dueAt?: string,                    // optional deadline
//     // "series": N occurrences, every intervalHours, starting at startAt
//     count?: number,                    // for series
//     intervalHours?: number,            // for series
//     startAt?: string,                  // for series, ISO; default = now
//   }
// }
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: idStr } = await ctx.params;
  const surveyId = Number(idStr);
  if (!Number.isInteger(surveyId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const survey = q.getSurveyById.get(surveyId);
  if (!survey) return NextResponse.json({ error: "not found" }, { status: 404 });

  type DeployBody = {
    participantIds?: number[] | "all";
    required?: boolean;
    schedule?: {
      kind?: "now" | "at" | "series";
      availableAt?: string;
      dueAt?: string;
      count?: number;
      intervalHours?: number;
      startAt?: string;
    };
  };
  const body = (await req.json().catch(() => null)) as DeployBody | null;

  // Resolve participant ids
  let participantIds: number[] = [];
  if (body?.participantIds === "all") {
    participantIds = q.listParticipants.all().map((p) => p.id);
  } else if (Array.isArray(body?.participantIds)) {
    participantIds = body!.participantIds.filter((n) => Number.isInteger(n));
  }
  if (!participantIds.length) {
    return NextResponse.json({ error: "no participants" }, { status: 400 });
  }

  const required = body?.required !== false ? 1 : 0;
  const schedule = body?.schedule ?? { kind: "now" };
  const kind = schedule.kind ?? "now";

  type Slot = { availableAt: string | null; dueAt: string | null; n: number };
  const slots: Slot[] = [];

  if (kind === "now") {
    slots.push({
      availableAt: null,
      dueAt: schedule.dueAt ?? null,
      n: 1,
    });
  } else if (kind === "at") {
    if (!schedule.availableAt) {
      return NextResponse.json(
        { error: "availableAt required for kind=at" },
        { status: 400 }
      );
    }
    slots.push({
      availableAt: schedule.availableAt,
      dueAt: schedule.dueAt ?? null,
      n: 1,
    });
  } else if (kind === "series") {
    const count = Number(schedule.count);
    const intervalHours = Number(schedule.intervalHours);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      return NextResponse.json(
        { error: "count must be 1–100 for series" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(intervalHours) || intervalHours <= 0) {
      return NextResponse.json(
        { error: "intervalHours must be > 0 for series" },
        { status: 400 }
      );
    }
    const startMs = schedule.startAt
      ? new Date(schedule.startAt).getTime()
      : Date.now();
    if (Number.isNaN(startMs)) {
      return NextResponse.json({ error: "startAt invalid" }, { status: 400 });
    }
    for (let i = 0; i < count; i++) {
      const t = new Date(startMs + i * intervalHours * 3600 * 1000).toISOString();
      slots.push({
        availableAt: i === 0 && !schedule.startAt ? null : t,
        dueAt: null,
        n: i + 1,
      });
    }
  } else {
    return NextResponse.json({ error: "unknown schedule.kind" }, { status: 400 });
  }

  const seriesId =
    kind === "series" ? `s_${randomBytes(6).toString("hex")}` : null;

  let created = 0;
  const txn = db.transaction(() => {
    for (const pid of participantIds) {
      for (const slot of slots) {
        q.insertAssignment.run({
          survey_id: surveyId,
          participant_id: pid,
          available_at: slot.availableAt,
          due_at: slot.dueAt,
          required,
          series_id: seriesId,
          occurrence_n: kind === "series" ? slot.n : null,
        });
        created++;
      }
    }
  });
  txn();

  logEvent({
    participantId: null,
    kind: "survey_deployed",
    meta: {
      survey_id: surveyId,
      slug: survey.slug,
      participant_count: participantIds.length,
      slot_count: slots.length,
      kind,
      series_id: seriesId,
    },
  });

  return NextResponse.json({
    ok: true,
    created,
    seriesId,
  });
}
