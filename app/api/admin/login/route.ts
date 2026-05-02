import { NextResponse } from "next/server";
import {
  adminTokenConfigured,
  adminTokenMatches,
  buildAdminCookie,
} from "@/lib/admin-auth";
import { logEvent } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!adminTokenConfigured()) {
    return NextResponse.json(
      { error: "MERCURY_ADMIN_TOKEN not configured on the server" },
      { status: 503 }
    );
  }
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  if (!adminTokenMatches(body?.token)) {
    return NextResponse.json({ error: "bad admin token" }, { status: 401 });
  }
  logEvent({ participantId: null, kind: "admin_login" });
  return NextResponse.json(
    { ok: true },
    { headers: { "set-cookie": buildAdminCookie(body!.token!) } }
  );
}
