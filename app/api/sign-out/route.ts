import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { q, logEvent } from "@/lib/db";
import { SESSION_COOKIE, clearSessionCookieHeader } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const row = q.getSession.get(token);
    q.deleteSession.run(token);
    if (row) logEvent({ participantId: row.id, kind: "logout" });
  }
  return NextResponse.json(
    { ok: true },
    { headers: { "set-cookie": clearSessionCookieHeader() } }
  );
}
