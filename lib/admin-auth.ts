// Researcher-side auth. Two paths to "I am admin":
//   1. MERCURY_ADMIN_TOKEN — pilot-local, set by /admin/login posting the
//      shared token. Stored in HttpOnly cookie on /pilot.
//   2. SSO from the hub — the hub mints an HS256 JWT under cookie
//      `mercury_session` (same hostname → cookie visible to /pilot/*). If
//      HUB_SESSION_SECRET_HEX is set in pilot's env and the JWT verifies
//      with role=admin, we accept it. No second sign-in.
//
// The pilot intentionally re-derives the verification rather than calling
// out to the hub: the iMac runs both apps, and a network hop for every
// request would be silly.

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "mercury_admin";
const HUB_SESSION_COOKIE = "mercury_session";

export function adminTokenConfigured(): boolean {
  return Boolean(process.env.MERCURY_ADMIN_TOKEN);
}

export function hubSsoConfigured(): boolean {
  return Boolean(process.env.HUB_SESSION_SECRET_HEX);
}

export function adminTokenMatches(candidate: string | null | undefined): boolean {
  const expected = process.env.MERCURY_ADMIN_TOKEN;
  if (!expected || !candidate) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// HS256 JWT verification — matches the hub's lib/session.ts (jose with the
// secret stored as hex in _hub/secrets/session_secret). Done with
// node:crypto so we don't need to add `jose` as a pilot dep.
function verifyHubJwt(
  token: string,
  secretHex: string
): { email: string; role: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  let expected: Buffer;
  let got: Buffer;
  try {
    expected = createHmac("sha256", Buffer.from(secretHex, "hex"))
      .update(`${h}.${p}`)
      .digest();
    got = Buffer.from(s, "base64url");
  } catch {
    return null;
  }
  if (got.length !== expected.length) return null;
  if (!timingSafeEqual(got, expected)) return null;
  let payload: { email?: unknown; role?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return null;
  }
  if (typeof payload.email !== "string" || typeof payload.role !== "string") {
    return null;
  }
  return { email: payload.email, role: payload.role };
}

export async function hubAdminFromCookie(): Promise<{ email: string } | null> {
  const secretHex = process.env.HUB_SESSION_SECRET_HEX;
  if (!secretHex) return null;
  const store = await cookies();
  const token = store.get(HUB_SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyHubJwt(token, secretHex);
  if (!payload || payload.role !== "admin") return null;
  return { email: payload.email };
}

export function buildAdminCookie(token: string): string {
  const maxAge = 60 * 60 * 24 * 30;
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearAdminCookie(): string {
  const parts = [
    `${ADMIN_COOKIE}=`,
    `Path=/`,
    `Max-Age=0`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  const ownCookie = store.get(ADMIN_COOKIE)?.value;
  if (adminTokenMatches(ownCookie)) return true;
  // Fall through to hub SSO — same browser, same hostname, same cookie jar.
  if (await hubAdminFromCookie()) return true;
  return false;
}

// Header-based fallback (preserves the existing /api/admin/esm-trigger
// header-token pattern).
export function isAdminHeader(req: Request): boolean {
  return adminTokenMatches(req.headers.get("x-admin-token"));
}
