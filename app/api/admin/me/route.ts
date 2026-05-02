import { NextResponse } from "next/server";
import {
  adminTokenConfigured,
  adminTokenMatches,
  ADMIN_COOKIE,
  hubAdminFromCookie,
  hubSsoConfigured,
} from "@/lib/admin-auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const store = await cookies();
  const ownCookie = store.get(ADMIN_COOKIE)?.value;
  const viaToken = adminTokenMatches(ownCookie);
  const hubAdmin = viaToken ? null : await hubAdminFromCookie();

  return NextResponse.json({
    configured: adminTokenConfigured(),
    sso: hubSsoConfigured(),
    authenticated: viaToken || Boolean(hubAdmin),
    via: viaToken ? "token" : hubAdmin ? "sso" : null,
    email: hubAdmin?.email ?? null,
  });
}
