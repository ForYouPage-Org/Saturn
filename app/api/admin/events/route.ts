import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(
    500,
    Number(new URL(req.url).searchParams.get("limit") ?? 100)
  );
  const events = q.recentEvents.all(limit).map((e) => ({
    ...e,
    meta: e.meta ? (JSON.parse(e.meta) as Record<string, unknown>) : null,
  }));
  return NextResponse.json({ events });
}
