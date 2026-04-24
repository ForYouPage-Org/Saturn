import { NextResponse } from "next/server";
import { db, q, nowIso } from "@/lib/db";

export const runtime = "nodejs";

const ADMIN_TOKEN = process.env.MERCURY_ADMIN_TOKEN;

export async function POST(req: Request) {
  if (!ADMIN_TOKEN) {
    return NextResponse.json({ error: "admin endpoint not configured" }, { status: 503 });
  }
  if (req.headers.get("x-admin-token") !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "bad admin token" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    title?: string;
    body?: string;
    participantIds?: number[];
  };
  const slug = body.slug ?? "baseline";
  const title = body.title ?? "Quick check-in";
  const bodyText = body.body ?? "Got 30 seconds for a research check-in?";

  type Target = { id: number; expo_push_token: string };
  let targets: Target[];
  if (Array.isArray(body.participantIds) && body.participantIds.length) {
    const placeholders = body.participantIds.map(() => "?").join(",");
    targets = db
      .prepare(
        `select id, expo_push_token from participants
          where id in (${placeholders}) and expo_push_token is not null`
      )
      .all(...body.participantIds) as Target[];
  } else {
    targets = q.listParticipantsWithPush.all() as Target[];
  }

  if (!targets.length) {
    return NextResponse.json({ sent: 0, note: "no participants with push tokens" });
  }

  const triggered_at = nowIso();
  const messages = targets.map((p) => ({
    to: p.expo_push_token,
    title,
    body: bodyText,
    sound: "default",
    data: { type: "esm", slug, triggered_at },
  }));

  const errors: string[] = [];
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const r = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!r.ok) errors.push(`${r.status}: ${(await r.text()).slice(0, 300)}`);
      else sent += chunk.length;
    } catch (err) {
      errors.push((err as Error).message);
    }
  }

  return NextResponse.json({ sent, errors });
}
