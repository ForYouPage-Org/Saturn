import { NextResponse } from "next/server";
import { q, newToken, toClientParticipant } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";
import { buildSessionCookie } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    participantCode?: string;
    password?: string;
  } | null;

  if (typeof body?.participantCode !== "string" || typeof body?.password !== "string") {
    return NextResponse.json({ error: "missing credentials" }, { status: 400 });
  }

  const code = body.participantCode.trim().toLowerCase();
  const participant = q.getParticipantByCode.get(code);
  // Deliberately vague so we don't leak whether a code exists.
  const bad = NextResponse.json({ error: "incorrect code or password" }, { status: 401 });
  if (!participant) return bad;
  if (!participant.password_hash) {
    return NextResponse.json(
      { error: "account has no password set — contact the study team" },
      { status: 403 }
    );
  }
  if (!verifyPassword(body.password, participant.password_hash)) return bad;

  const token = newToken();
  q.insertSession.run(token, participant.id);
  return NextResponse.json(
    { participant: toClientParticipant(participant) },
    { headers: { "set-cookie": buildSessionCookie(token) } }
  );
}
