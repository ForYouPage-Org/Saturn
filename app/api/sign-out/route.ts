import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { q } from "@/lib/db";
import { SESSION_COOKIE, clearSessionCookieHeader } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) q.deleteSession.run(token);
  return NextResponse.json(
    { ok: true },
    { headers: { "set-cookie": clearSessionCookieHeader() } }
  );
}
