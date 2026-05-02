import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { q, type EsmQuestion } from "@/lib/db";

export const runtime = "nodejs";

const VALID_CATEGORIES = ["esm", "scale", "baseline", "adhoc"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

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

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = q.listSurveys.all().map((s) => ({
    ...s,
    active: s.active === 1,
    archived: s.archived === 1,
    questions: JSON.parse(s.questions) as EsmQuestion[],
    response_count: q.countResponsesBySurvey.get(s.id)?.n ?? 0,
  }));
  return NextResponse.json({ surveys: rows });
}

export async function POST(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    slug?: string;
    title?: string;
    questions?: unknown;
    active?: boolean;
    category?: string;
    description?: string | null;
    instructions?: string | null;
  } | null;

  if (!body?.slug || !/^[a-z0-9][a-z0-9_-]{1,60}$/.test(body.slug)) {
    return NextResponse.json(
      { error: "slug must be 2–60 chars, [a-z0-9_-]" },
      { status: 400 }
    );
  }
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (!validateQuestions(body.questions)) {
    return NextResponse.json(
      { error: "questions must be a non-empty array of likert/text/choice items" },
      { status: 400 }
    );
  }
  const category: Category = VALID_CATEGORIES.includes(body.category as Category)
    ? (body.category as Category)
    : "esm";

  if (q.getSurveyBySlug.get(body.slug)) {
    return NextResponse.json({ error: "slug already exists" }, { status: 409 });
  }

  const inserted = q.insertSurvey.get({
    slug: body.slug,
    title: body.title,
    questions: JSON.stringify(body.questions),
    active: body.active === false ? 0 : 1,
    category,
    description: body.description ?? null,
    instructions: body.instructions ?? null,
  });

  return NextResponse.json({ survey: inserted });
}
