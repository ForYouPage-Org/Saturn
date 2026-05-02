# Mercury

Pilot app for a teen research study. Two things:

1. **A ChatGPT-like chatbot** (web, with native wrapping available later via Capacitor) so teens can chat with an AI assistant and we collect every turn.
2. **Experience sampling (ESM)** — we can push a short check-in survey at any time, and the teen fills it out in the app.

Stack:

- **Next.js 15 (App Router) + assistant-ui** for the web UI. Streaming chat via the Vercel AI SDK; markdown rendering and ChatGPT-like composer out of the box.
- **SQLite** (`better-sqlite3`) for storage, lazy-initialised on the first API call.
- **Azure OpenAI** via `@ai-sdk/azure`. Key in `secrets/server.env`, never in the client.
- **Self-hosted on `marxs-imac`** under one LaunchAgent (`com.mercury.pilot.web`), publicly exposed on the shared **Tailscale Funnel** at `/pilot` alongside the hub at `/`.

Integration with the `ai-teen` analysis project is intentionally thin: CSV export via [scripts/export_data.sh](scripts/export_data.sh), then ingest with the existing pipeline.

The pre-migration Expo scaffold is preserved on branch [`archive/expo-shell`](https://github.com/ForYouPage-Org/Saturn/tree/archive/expo-shell). The repo name on GitHub is `Saturn` for historical reasons — the current `main` is mercury-pilot.

---

## Layout

```
app/
  layout.tsx                 # Root layout, globals
  page.tsx                   # Enrollment (/)
  chat/page.tsx              # assistant-ui Thread (/chat) — locks behind required surveys
  esm/page.tsx               # On-demand ESM form (/esm)
  _components/
    SurveyForm.tsx           # Renders likert/text/choice question lists
    PendingSurveyGate.tsx    # Polls /api/surveys/pending; locks chat with modal
  admin/                     # Researcher dashboard — gated by MERCURY_ADMIN_TOKEN
    layout.tsx               # Sidebar + auth check
    login/page.tsx
    page.tsx                 # Overview (counts + recent activity)
    participants/            # List + per-participant detail (transcript, responses, events)
    surveys/                 # CRUD + per-survey deploy form
    events/page.tsx          # Activity feed
  api/
    health/route.ts
    enroll/route.ts          # POST: sign up (participant code + password)
    sign-in/route.ts         # POST: returning participant
    sign-out/route.ts
    me/route.ts              # GET: current participant (or null)
    messages/route.ts        # GET: chat history for bootstrap
    chat/route.ts            # POST: streaming chat (Azure + usage log)
    esm/
      active/route.ts        # GET: current active survey
      response/route.ts      # POST: submit answers (closes assignment if linked)
    surveys/
      pending/route.ts       # GET: next pending assignment for the current participant
    admin/
      login/route.ts         # POST: trade MERCURY_ADMIN_TOKEN for HttpOnly cookie
      logout/route.ts
      me/route.ts            # GET: { configured, authenticated }
      overview/route.ts      # GET: dashboard counters
      events/route.ts        # GET: activity feed
      participants/route.ts  # GET: all participants + stats
      participants/[id]/route.ts  # GET: full transcript / responses / assignments / events
      surveys/route.ts       # GET / POST: list + create
      surveys/[id]/route.ts  # GET / PATCH / DELETE
      surveys/[id]/deploy/route.ts  # POST: create survey_assignments (now / at / series)
      esm-trigger/route.ts   # (legacy) POST: researcher-only push broadcast

lib/
  db.ts                      # better-sqlite3 + lazy-init singleton; logEvent helper
  schema.sql   seed.sql      # applied on first DB access; adds columns idempotently
  azure.ts                   # @ai-sdk/azure wrapper
  azure-usage.ts             # appends to hub's azure_usage.jsonl
  passwords.ts               # scrypt-based password hashing
  auth-server.ts             # HttpOnly-cookie session helpers (participants)
  admin-auth.ts              # HttpOnly-cookie + header helpers (researcher)
  utils.ts                   # cn() + generateCode() (funky-panda-42 style)

scripts/
  run_web.sh                 # LaunchAgent entrypoint for `next start`
  install_launchagent.sh     # installs com.mercury.pilot.web
  tailscale_serve.sh         # registers /pilot on the shared Funnel
  push_and_deploy.sh         # source → target iMac deploy
  export_data.sh             # sqlite3 → CSVs for ai-teen

data/                        # SQLite DB at runtime (gitignored)
secrets/                     # Runtime secrets (gitignored except .example)
```

---

## Local dev

```bash
npm install
npm run dev          # next dev on 127.0.0.1:3002, no /pilot prefix
# open http://127.0.0.1:3002
```

DB is created lazily at `data/pilot.sqlite` on the first API call. To test chat locally, create `secrets/server.env` with `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL` and restart.

---

## Deploying to the iMac

The source Mac builds + pushes. The target iMac (`marxs-imac` on the Tailscale tailnet) runs `next start` on port **3002**, kept alive by a LaunchAgent. Public URL via the shared Tailscale Funnel: `https://marxs-imac.tail876aa7.ts.net/pilot`.

### One-time, on the target iMac

```bash
git clone https://github.com/ForYouPage-Org/Saturn.git ~/Developer/_mercury-pilot
cd ~/Developer/_mercury-pilot
# Put secrets/server.env in place (or let `make deploy` rsync it for you).
bash setup.sh
bash scripts/install_launchagent.sh
bash scripts/tailscale_serve.sh     # registers /pilot on the Funnel
```

Prereqs on target: Node 20+, Xcode Command Line Tools (for `better-sqlite3` native build), Tailscale, Remote Login on, source's SSH key in `~/.ssh/authorized_keys`.

### One-time, on the source

```bash
cp scripts/mercury-pilot-push.env.example ~/.mercury-pilot-push.env
chmod 600 ~/.mercury-pilot-push.env
# Edit MERCURY_PILOT_TARGET_HOST / _PATH / _USER to match the iMac
```

### Daily flow

```bash
git push                 # push to origin/main
make deploy              # rsync secrets + git pull + next build + kickstart on target
# or:
make ship                # build locally first, then deploy
```

`make deploy` does: snapshot target's `data/pilot.sqlite` back to `secrets/backups/<utc>/` (safety), `ssh target`, `git reset --hard origin/main`, rsync `secrets/server.env`, `npm install` (if `package-lock.json` changed), `next build`, `launchctl kickstart` the web agent. **Never touches `data/` on the target.**

### Tailscale serve / funnel

`scripts/tailscale_serve.sh` runs `tailscale funnel --bg --https=443 --set-path=/pilot http://127.0.0.1:3002/pilot`. The target URL includes `/pilot` so the prefix is preserved on the wire, matching Next.js's `basePath: "/pilot"`. **Do not** use `tailscale serve` — it demotes the hostname to tailnet-only and breaks the hub's public access.

### Local commands

```bash
make dev             # next dev on :3002, no /pilot prefix (for fast iteration)
make build           # next build
make start           # next start on :3002, reads secrets/server.env
make install-agent   # install the LaunchAgent
make status          # show LaunchAgent state
make logs            # tail server stdout/stderr
make uninstall-agent # unload + remove the plist
make tailscale-serve # (on target) register /pilot on the Tailscale Funnel
```

---

## Survey deployment (the dashboard way)

The researcher dashboard at `/admin` is the primary surface for authoring and
deploying surveys. It uses cookie auth — sign in once with the
`MERCURY_ADMIN_TOKEN` from `secrets/server.env` and the rest is point-and-click.

1. **Author** at `/admin/surveys/new`. Pick a category:
   - **ESM** — short, in-the-moment (mood, what-are-you-doing-now)
   - **Scale** — validated multi-item instruments (PHQ-9, GAD-7, BFI-10, …)
   - **Baseline** — one-time at enrollment (demographics, etc.)
   - **Adhoc** — anything else

2. **Deploy** at `/admin/surveys/[id]/deploy`:
   - Pick which participants get it
   - Choose a schedule:
     - **Now** — single immediate assignment
     - **At a time** — single assignment available at a specific datetime
     - **Repeating** — `count` × `intervalHours` series (`series_id` links them).
       E.g. ESM 4×/day for a week → count=28, intervalHours=4. Weekly PHQ-9 →
       count=8, intervalHours=168.
   - Toggle **Required**. When on, the participant's chat is locked behind a
     full-screen modal until the survey is submitted; the modal pops the moment
     `available_at` passes (`/api/surveys/pending` polled every 60s and on tab
     focus).

3. **Watch results** at `/admin/participants/[id]` (full transcript, responses,
   events) and `/admin/events` (activity feed: enroll, login, chat_message,
   survey_shown, survey_completed, survey_deployed, …).

### Triggering an ESM push (legacy, native-only)

`POST /api/admin/esm-trigger`, gated by `MERCURY_ADMIN_TOKEN` from `secrets/server.env`:

```bash
curl -X POST https://marxs-imac.tail876aa7.ts.net/pilot/api/admin/esm-trigger \
  -H "x-admin-token: $MERCURY_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"slug":"baseline","title":"Check-in time","body":"Got 30 seconds?"}'
```

Push notifications only fire on native clients (iOS/Android via Capacitor when we add that). On web, participants use the **Check-in** link in the chat header.

### Authoring new surveys

`esm_surveys.questions` is a JSON-encoded array. Insert a new row and the app will render it automatically:

```bash
sqlite3 data/pilot.sqlite <<'SQL'
insert into esm_surveys (slug, title, questions, active) values (
  'end-of-day',
  'End-of-day reflection',
  '[
    {"id":"helpful","type":"likert","prompt":"How helpful was the assistant today?","min":1,"max":7},
    {"id":"topics","type":"choice","prompt":"What did you use it for?","multiple":true,"options":["Homework","Social","Fun"]},
    {"id":"notes","type":"text","prompt":"Anything else?","optional":true}
  ]',
  1
);
SQL
```

Supported question types: `likert`, `text`, `choice`. Set `optional: true` to allow blanks.

---

## Azure usage tracking via the hub dashboard

Every `/api/chat` call appends one JSON line to whatever file `AZURE_USAGE_LOG_PATH` points at (default `./logs/azure_usage.jsonl`). On the iMac, set it to `/Users/marx/Developer/_mercury/logs/azure_usage.jsonl` and mercury-pilot traffic shows up in the hub's `/admin/azure-usage` dashboard bucketed as `mercury-pilot:<participant_code>`.

Schema matches `_hub/web/src/lib/azure-usage.ts` exactly — see [lib/azure-usage.ts](lib/azure-usage.ts).

---

## Going native (later)

Wrap the Next.js app in [Capacitor](https://capacitorjs.com/) when ESM push reliability becomes a research bottleneck:

```bash
npm install -D @capacitor/cli @capacitor/core @capacitor/ios @capacitor/android @capacitor/push-notifications
npx cap init Mercury edu.research.mercury --web-dir=out
```

Configure `next.config.ts` to `output: "export"` for Capacitor's static export, or point Capacitor at the hosted URL via `server.url`. Then `npx cap add ios`, `npx cap add android`, and ship to TestFlight / Play Console. Push notifications flow through Capacitor's `@capacitor/push-notifications` plugin to `/api/admin/esm-trigger`.

Keep one Next.js codebase; the native shells are a build step, not a rewrite.

---

## Pulling data into the ai-teen analysis pipeline

From the source Mac:

```bash
scp marxs-imac:~/Developer/_mercury-pilot/data/pilot.sqlite ./data/
./scripts/export_data.sh
```

Writes `data-export/participants.csv`, `messages.csv`, `esm_responses.csv`, `esm_surveys.csv`. Feed those into `ai-teen/extract_conversations.py`.

---

## Safety notes

- Auth is an opaque Bearer token stored as an HttpOnly cookie on the client. No XSS path to the token.
- Passwords are salted + scrypt-hashed. No password recovery — a researcher has to clear the row manually if a teen forgets.
- The Azure key only lives in `secrets/server.env` on machines running the server. `secrets/` is gitignored; rsynced source→target with `chmod 600`.
- The system prompt in [app/api/chat/route.ts](app/api/chat/route.ts) nudges the model toward age-appropriate replies and flags distress. Review and adjust before real participants.
- Consent is a single checkbox today. For IRB-compliant recruiting, replace the enrollment flow with proper assent + parental-consent text.
