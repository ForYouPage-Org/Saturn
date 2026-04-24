import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/auth-server";
import { q, type EsmQuestion } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const me = await getCurrentParticipant();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const slug = new URL(req.url).searchParams.get("slug");
  const row = q.getActiveSurvey.get(slug ?? null, slug ?? null);
  if (!row) return NextResponse.json({ survey: null });

  return NextResponse.json({
    survey: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      active: !!row.active,
      questions: JSON.parse(row.questions) as EsmQuestion[],
    },
  });
}
