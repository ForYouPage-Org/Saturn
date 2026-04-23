// ESM trigger: researcher-only endpoint that sends an Expo push notification
// to all enrolled participants (or a subset), opening the ESM screen.
//
// Auth: this function requires the service-role key in the Authorization
// header (not a user JWT). Deploy with `--no-verify-jwt` so we can enforce
// auth ourselves:
//   supabase functions deploy esm-trigger --no-verify-jwt
//
// Invoke from a researcher machine:
//   curl -X POST https://<project>.functions.supabase.co/esm-trigger \
//     -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
//     -H "content-type: application/json" \
//     -d '{"slug":"baseline","title":"Quick check-in","body":"Got 30 seconds?"}'
//
// Or schedule it with pg_cron / Supabase Cron hitting this endpoint.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_KEY}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const {
    slug = "baseline",
    title = "Quick check-in",
    body = "Got 30 seconds for a research check-in?",
    participantIds, // optional: array of participant ids; otherwise broadcast to all
  } = (await req.json().catch(() => ({}))) as {
    slug?: string;
    title?: string;
    body?: string;
    participantIds?: string[];
  };

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let query = admin
    .from("participants")
    .select("id, expo_push_token")
    .not("expo_push_token", "is", null);
  if (participantIds?.length) query = query.in("id", participantIds);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const triggered_at = new Date().toISOString();
  const messages = (data ?? []).map((p) => ({
    to: p.expo_push_token,
    title,
    body,
    sound: "default",
    data: { type: "esm", slug, triggered_at },
  }));

  if (!messages.length) {
    return json({ sent: 0, note: "No participants with push tokens" });
  }

  // Expo Push API accepts up to 100 messages per request.
  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  let sent = 0;
  const errors: string[] = [];
  for (const chunk of chunks) {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "accept-encoding": "gzip, deflate",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      errors.push(`${res.status}: ${(await res.text()).slice(0, 300)}`);
    } else {
      sent += chunk.length;
    }
  }

  return json({ sent, errors });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
