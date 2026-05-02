// Researcher-side auth. Single shared password from MERCURY_ADMIN_TOKEN —
// when the admin logs in, we set an HttpOnly cookie containing the same token
// so subsequent requests don't need the header. Cheap and good enough for a
// single-researcher pilot dashboard.

import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "mercury_admin";

export function adminTokenConfigured(): boolean {
  return Boolean(process.env.MERCURY_ADMIN_TOKEN);
}

export function adminTokenMatches(candidate: string | null | undefined): boolean {
  const expected = process.env.MERCURY_ADMIN_TOKEN;
  if (!expected || !candidate) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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
  const cookie = store.get(ADMIN_COOKIE)?.value;
  return adminTokenMatches(cookie);
}

// Header-based fallback (preserves the existing /api/admin/esm-trigger
// header-token pattern).
export function isAdminHeader(req: Request): boolean {
  return adminTokenMatches(req.headers.get("x-admin-token"));
}
