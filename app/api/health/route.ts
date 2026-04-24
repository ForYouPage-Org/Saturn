import { NextResponse } from "next/server";
import { azureReady } from "@/lib/azure";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    azure: azureReady(),
    time: new Date().toISOString(),
  });
}
