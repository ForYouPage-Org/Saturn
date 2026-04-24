import { NextResponse } from "next/server";
import { q, nowIso, newToken, toClientParticipant } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { buildSessionCookie } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    participantCode?: string;
    age?: number;
    consent?: boolean;
    password?: string;
  } | null;

  if (!body?.participantCode || typeof body.participantCode !== "string") {
    return NextResponse.json({ error: "missing participantCode" }, { status: 400 });
  }
  if (!Number.isInteger(body.age) || body.age! < 13 || body.age! > 19) {
    return NextResponse.json({ error: "age must be 13–19" }, { status: 400 });
  }
  if (!body.consent) {
    return NextResponse.json({ error: "consent required" }, { status: 400 });
  }
  if (typeof body.password !== "string" || body.password.length < 6) {
    return NextResponse.json(
      { error: "password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const code = body.participantCode.trim().toLowerCase();
  if (q.getParticipantByCode.get(code)) {
    return NextResponse.json(
      { error: "that participant code is already taken — try Generate, or sign in" },
      { status: 409 }
    );
  }

  const participant = q.insertParticipant.get({
    participant_code: code,
    age: body.age!,
    consent_at: nowIso(),
    password_hash: hashPassword(body.password),
  });

  const token = newToken();
  q.insertSession.run(token, participant!.id);

  return NextResponse.json(
    { participant: toClientParticipant(participant!) },
    { headers: { "set-cookie": buildSessionCookie(token) } }
  );
}
