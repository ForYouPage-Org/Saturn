// Server-side auth helpers for Next.js route handlers and server components.
//
// Session tokens live in an HttpOnly cookie named `mercury_session`. The
// client never sees the raw token (can't be stolen by XSS), and fetch() to
// /api/* picks it up automatically because same-origin cookies are sent.

import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { q, type ParticipantRow } from "./db";

export const SESSION_COOKIE = "mercury_session";

export function buildSessionCookie(token: string): string {
  // 180 days — pilot-length session.
  const maxAge = 60 * 60 * 24 * 180;
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  // In dev the app runs over http://localhost — Secure would drop the cookie.
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    `Path=/`,
    `Max-Age=0`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export async function getCurrentParticipant(): Promise<ParticipantRow | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = q.getSession.get(token);
  if (!row) return null;
  // q.getSession returns the participant row with the session token attached;
  // normalize back to a plain participant row.
  const { token: _t, ...participant } = row;
  void _t;
  return participant as ParticipantRow;
}

// Read-token helper for use in Request-scoped handlers that have a `req`.
// Cookies API in route handlers requires `await cookies()` per Next 15.
export function tokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE)?.value ?? null;
}
