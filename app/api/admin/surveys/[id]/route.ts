import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { q, type EsmQuestion } from "@/lib/db";

export const runtime = "nodejs";

const VALID_CATEGORIES = ["esm", "scale", "baseline", "adhoc"] as const;

function validateQuestions(qs: unknown): qs is EsmQuestion[] {
  if (!Array.isArray(qs) || qs.length === 0) return false;
  for (const q of qs) {
    if (!q || typeof q !== "object") return false;
    const obj = q as Record<string, unknown>;
    if (typeof obj.id !== "string" || typeof obj.prompt !== "string") return false;
    if (obj.type === "likert") {
      if (typeof obj.min !== "number" || typeof obj.max !== "number") return false;
      if (obj.max <= obj.min) return false;
    } else if (obj.type === "text") {
      // ok
    } else if (obj.type === "choice") {
      if (!Array.isArray(obj.options) || obj.options.length === 0) return false;
    } else {
      return false;
    }
  }
  return true;
}

async function adminId(ctx: { params: Promise<{ id: string }> }): Promise<number | null> {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  return Number.isInteger(id) ? id : null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = await adminId(ctx);
  if (id === null) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const s = q.getSurveyById.get(id);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const assignments = q.listAssignmentsBySurvey.all(id);
  return NextResponse.json({
    survey: {
      ...s,
      active: s.active === 1,
      archived: s.archived === 1,
      questions: JSON.parse(s.questions) as EsmQuestion[],
    },
    assignments,
    response_count: q.countResponsesBySurvey.get(id)?.n ?? 0,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = await adminId(ctx);
  if (id === null) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const existing = q.getSurveyById.get(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    questions?: unknown;
    active?: boolean;
    archived?: boolean;
    category?: string;
    description?: string | null;
    instructions?: string | null;
  } | null;

  const title = body?.title ?? existing.title;
  if (typeof title !== "string" || !title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  let questions: EsmQuestion[];
  if (body?.questions !== undefined) {
    if (!validateQuestions(body.questions)) {
      return NextResponse.json({ error: "invalid questions" }, { status: 400 });
    }
    questions = body.questions;
  } else {
    questions = JSON.parse(existing.questions) as EsmQuestion[];
  }
  const category = VALID_CATEGORIES.includes(
    (body?.category ?? existing.category) as (typeof VALID_CATEGORIES)[number]
  )
    ? (body?.category ?? existing.category)
    : existing.category;

  q.updateSurvey.run({
    id,
    title,
    questions: JSON.stringify(questions),
    active: body?.active === undefined ? existing.active : body.active ? 1 : 0,
    category,
    description: body?.description ?? existing.description,
    instructions: body?.instructions ?? existing.instructions,
    archived:
      body?.archived === undefined ? existing.archived : body.archived ? 1 : 0,
  });

  const updated = q.getSurveyById.get(id);
  return NextResponse.json({ survey: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = await adminId(ctx);
  if (id === null) return NextResponse.json({ error: "bad id" }, { status: 400 });
  q.deleteSurvey.run(id);
  return NextResponse.json({ ok: true });
}
