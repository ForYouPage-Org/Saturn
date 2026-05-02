import { NextResponse } from "next/server";
import { adminTokenConfigured, isAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    configured: adminTokenConfigured(),
    authenticated: await isAdminRequest(),
  });
}
