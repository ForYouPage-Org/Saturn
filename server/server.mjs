// Mercury pilot — combined static + API server.
// One Node process: serves the exported Expo web bundle from `dist/` and the
// `/api/*` routes backed by SQLite. Keeps the deploy story to one LaunchAgent.
//
// Env:
//   PORT (default 3002)
//   HOST (default 127.0.0.1)
//   DIST (default ./dist, relative to repo root)
//   MERCURY_DB (default ./data/pilot.sqlite)
//   MERCURY_ADMIN_TOKEN — required for POST /api/admin/esm-trigger
//   AZURE_OPENAI_API_KEY, AZURE_OPENAI_BASE_URL, AZURE_OPENAI_MODEL,
//   AZURE_OPENAI_API_VERSION, AZURE_OPENAI_REASONING_EFFORT
//
// Flags:
//   --init-only   initialise DB + seed, then exit (for `npm run db:init`).

import express from "express";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";
import { db, q, nowIso, newToken } from "./db.mjs";
import { complete as azureComplete, isConfigured as azureReady, modelName as azureModel } from "./azure.mjs";
import { logCall as logAzureCall, usageLogPath } from "./azure-usage.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(HERE, "..");
const DIST = resolve(ROOT, process.env.DIST ?? "dist");
const PORT = Number(process.env.PORT ?? 3002);
const HOST = process.env.HOST ?? "127.0.0.1";
const ADMIN_TOKEN = process.env.MERCURY_ADMIN_TOKEN;
const HISTORY_WINDOW = Number(process.env.MERCURY_HISTORY_WINDOW ?? 20);
const SYSTEM_PROMPT =
  process.env.MERCURY_SYSTEM_PROMPT ??
  "You are a helpful, friendly assistant for a teenage user participating in a research study. " +
    "Be warm, concise, and age-appropriate. Do not ask for or store any personally identifying information. " +
    "If the user expresses serious distress or mentions self-harm, gently suggest reaching out to a trusted adult or a crisis resource.";

if (process.argv.includes("--init-only")) {
  console.log(`DB initialised at ${process.env.MERCURY_DB ?? resolve(ROOT, "data/pilot.sqlite")}`);
  process.exit(0);
}

const app = express();
app.use(express.json({ limit: "256kb" }));

// ── Auth middleware — populates req.participant from Bearer token ────────────
function authRequired(req, res, next) {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  const session = q.getSession.get(token);
  if (!session) return res.status(401).json({ error: "invalid token" });
  req.token = token;
  req.participant = {
    id: session.id,
    participant_code: session.participant_code,
    age: session.age,
    consent_at: session.consent_at,
    enrolled_at: session.enrolled_at,
    expo_push_token: session.expo_push_token,
  };
  next();
}

function adminRequired(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(503).json({ error: "admin endpoint not configured" });
  const header = req.get("x-admin-token") ?? "";
  if (header !== ADMIN_TOKEN) return res.status(401).json({ error: "bad admin token" });
  next();
}

// ── /api/health ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, azure: azureReady(), time: nowIso() });
});

// ── /api/enroll ──────────────────────────────────────────────────────────────
app.post("/api/enroll", (req, res) => {
  const { participantCode, age, consent } = req.body ?? {};
  if (!participantCode || typeof participantCode !== "string") {
    return res.status(400).json({ error: "missing participantCode" });
  }
  if (!Number.isInteger(age) || age < 13 || age > 19) {
    return res.status(400).json({ error: "age must be 13–19" });
  }
  if (!consent) return res.status(400).json({ error: "consent required" });

  const code = participantCode.trim().toUpperCase();
  const existing = q.getParticipantByCode.get(code);
  let participant = existing;
  if (!existing) {
    participant = q.insertParticipant.get({
      participant_code: code,
      age,
      consent_at: nowIso(),
    });
  }

  const token = newToken();
  q.insertSession.run(token, participant.id);
  res.json({ token, participant });
});

// ── /api/me ──────────────────────────────────────────────────────────────────
app.get("/api/me", authRequired, (req, res) => {
  res.json({ participant: req.participant });
});

app.post("/api/sign-out", authRequired, (req, res) => {
  q.deleteSession.run(req.token);
  res.json({ ok: true });
});

app.put("/api/me/push-token", authRequired, (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ error: "missing token" });
  }
  q.updatePushToken.run(token, req.participant.id);
  res.json({ ok: true });
});

// ── /api/messages ────────────────────────────────────────────────────────────
app.get("/api/messages", authRequired, (req, res) => {
  const rows = q.listMessages.all(req.participant.id);
  res.json({ messages: rows });
});

// ── /api/chat — persist user, call Azure, persist assistant, return ─────────
app.post("/api/chat", authRequired, async (req, res) => {
  const content = (req.body?.content ?? "").toString().trim();
  if (!content) return res.status(400).json({ error: "empty message" });
  if (content.length > 8000) return res.status(400).json({ error: "too long" });

  q.insertMessage.run({
    participant_id: req.participant.id,
    role: "user",
    content,
  });

  const recent = q.recentMessages.all(req.participant.id, HISTORY_WINDOW * 2);
  const history = recent.reverse();
  const input = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map(({ role, content }) => ({ role, content })),
  ];

  let result;
  try {
    result = await azureComplete(input);
  } catch (err) {
    console.error(err);
    // Log the failed call too — cost is 0 but timing + error are useful.
    logAzureCall({
      participantCode: req.participant.participant_code,
      model: azureModel(),
      prompt: content,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      durationMs: err.durationMs ?? 0,
      error: err.message ?? "chat failed",
    });
    return res.status(502).json({ error: err.message ?? "chat failed" });
  }

  logAzureCall({
    participantCode: req.participant.participant_code,
    model: azureModel(),
    prompt: content,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    reasoningTokens: result.reasoningTokens,
    durationMs: result.durationMs,
  });

  if (!result.text) {
    return res.status(502).json({ error: "empty completion" });
  }

  const saved = q.insertMessage.get({
    participant_id: req.participant.id,
    role: "assistant",
    content: result.text,
  });
  res.json({ message: saved });
});

// ── /api/esm — fetch active survey, submit response ─────────────────────────
app.get("/api/esm/active", authRequired, (req, res) => {
  const slug = req.query.slug ? String(req.query.slug) : null;
  const row = q.getActiveSurvey.get(slug, slug);
  if (!row) return res.json({ survey: null });
  res.json({
    survey: { ...row, questions: JSON.parse(row.questions), active: !!row.active },
  });
});

app.post("/api/esm/response", authRequired, (req, res) => {
  const { surveyId, answers, triggeredAt } = req.body ?? {};
  if (!Number.isInteger(surveyId)) return res.status(400).json({ error: "surveyId must be an integer" });
  if (!answers || typeof answers !== "object") return res.status(400).json({ error: "answers missing" });

  const saved = q.insertEsmResponse.get({
    participant_id: req.participant.id,
    survey_id: surveyId,
    answers: JSON.stringify(answers),
    triggered_at: triggeredAt ?? null,
  });
  res.json({ response: saved });
});

// ── /api/admin/esm-trigger — researcher-only push broadcast ─────────────────
app.post("/api/admin/esm-trigger", adminRequired, async (req, res) => {
  const {
    slug = "baseline",
    title = "Quick check-in",
    body = "Got 30 seconds for a research check-in?",
    participantIds,
  } = req.body ?? {};

  let targets;
  if (Array.isArray(participantIds) && participantIds.length) {
    const placeholders = participantIds.map(() => "?").join(",");
    targets = db
      .prepare(
        `select id, expo_push_token from participants
          where id in (${placeholders}) and expo_push_token is not null`
      )
      .all(...participantIds);
  } else {
    targets = q.listParticipantsWithPush.all();
  }

  if (!targets.length) return res.json({ sent: 0, note: "no participants with push tokens" });

  const triggered_at = nowIso();
  const messages = targets.map((p) => ({
    to: p.expo_push_token,
    title,
    body,
    sound: "default",
    data: { type: "esm", slug, triggered_at },
  }));

  const errors = [];
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const r = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!r.ok) errors.push(`${r.status}: ${(await r.text()).slice(0, 300)}`);
      else sent += chunk.length;
    } catch (err) {
      errors.push(err.message);
    }
  }
  res.json({ sent, errors });
});

// ── Static — serve the Expo web bundle under `dist/` ────────────────────────
let distAvailable = false;
try {
  distAvailable = statSync(DIST).isDirectory();
} catch {
  distAvailable = false;
}

if (distAvailable) {
  app.use(
    express.static(DIST, {
      setHeaders: (res, path) => {
        if (path.endsWith("index.html")) res.setHeader("cache-control", "no-cache");
        else res.setHeader("cache-control", "public, max-age=3600");
      },
    })
  );
  // SPA fallback for client-side routing (expo-router single output).
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(join(DIST, "index.html"));
  });
} else {
  console.warn(`⚠ dist/ not found at ${DIST} — serving API only. Run \`npm run build:web\`.`);
}

app.listen(PORT, HOST, () => {
  console.log(
    `mercury → http://${HOST}:${PORT}  (api:${distAvailable ? "+static" : ""}, azure:${azureReady() ? "ready" : "not configured"})`
  );
  console.log(`  azure-usage log → ${usageLogPath()}`);
});
