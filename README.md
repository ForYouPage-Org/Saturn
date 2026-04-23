# Mercury

Pilot app for a teen research study. Two things:

1. **A minimal ChatGPT-like chatbot** (web + iOS + Android, one codebase) so teens can chat with an AI assistant and we collect every turn.
2. **Experience sampling (ESM)** — we can push a short check-in survey at any time, and the teen fills it out in the app.

Stack:

- **Expo (React Native)** — one codebase for web, iOS, Android.
- **Self-hosted Node server on the iMac** — Express + SQLite (`better-sqlite3`). One process serves both the static web bundle and `/api/*`. Matches the hub's pattern; no cloud backend to manage.
- **Azure OpenAI Responses API** — called from the server, key in `secrets/server.env`, never in the client.

Integration with the `ai-teen` analysis project is intentionally thin: pilot data exports as CSV via [scripts/export_data.sh](scripts/export_data.sh), then gets ingested by the existing pipeline.

The repo lives at **`ForYouPage-Org/Saturn`** (the name carried over from an earlier project; the prior code is preserved on branch `archive/social-app`).

---

## Layout

```
app/                       # Expo Router screens
  _layout.tsx              # Stack + notification-tap handler
  index.tsx                # Enrollment (code + age + consent)
  chat.tsx                 # ChatGPT-like screen
  esm.tsx                  # ESM form (modal)
lib/                       # Client utilities (thin wrappers around fetch)
  api.ts                   # HTTP client with Bearer-token auth
  auth.ts  chat.ts  esm.ts # feature modules that use api.ts
  notifications.ts         # Expo push token registration
server/                    # The Node API + static file server
  server.mjs               # Express app, all /api/* routes
  db.mjs                   # better-sqlite3 + prepared statements
  azure.mjs                # Azure OpenAI Responses API client
  schema.sql   seed.sql    # applied on startup (idempotent)
scripts/
  run_web.sh               # LaunchAgent entrypoint for server.mjs
  run_tunnel.sh            # LaunchAgent entrypoint for ngrok
  install_launchagent.sh
  push_and_deploy.sh       # source → target Mac deploy
  export_data.sh           # sqlite3 → CSVs for ai-teen
config/                    # LaunchAgent plist templates
data/                      # SQLite DB lives here at runtime (gitignored)
secrets/                   # Runtime secrets (gitignored except .example)
```

---

## Local dev (quick loop on your laptop)

```bash
cd /Users/marxw/Research/projects/mercury
npm install
cp secrets/server.env.example secrets/server.env
# Fill in AZURE_OPENAI_API_KEY + MERCURY_ADMIN_TOKEN (openssl rand -base64 32)

npm run db:init          # creates data/pilot.sqlite
npm run build:web        # exports to dist/
npm run serve            # starts server on 127.0.0.1:3002
# open http://127.0.0.1:3002
```

For iterative UI work, use `npm run web` (Expo dev server) in another terminal — it hot-reloads and still talks to the Node API at `/api/*` (Expo dev server proxies).

---

## Deploying to the iMac (same pattern as `_hub`)

The source Mac (this one) builds + pushes. The target iMac (`marxs-imac` on the Tailscale tailnet) hosts the Node server kept alive by a LaunchAgent on port **3002** (hub uses 3001; both can coexist). An optional ngrok LaunchAgent exposes it publicly.

### One-time, on the target iMac

```bash
git clone https://github.com/ForYouPage-Org/Saturn.git ~/Research/projects/mercury
cd ~/Research/projects/mercury
# Put secrets/server.env in place (or let `make deploy` rsync it for you).
bash setup.sh
bash scripts/install_launchagent.sh
```

Prereqs on target: Node 20+, Xcode Command Line Tools (for `better-sqlite3` native build), Tailscale, Remote Login on, source's SSH key in `~/.ssh/authorized_keys`.

### One-time, on the source (this Mac)

```bash
cp scripts/mercury-pilot-push.env.example ~/.mercury-pilot-push.env
chmod 600 ~/.mercury-pilot-push.env
# Edit MERCURY_PILOT_TARGET_HOST / _PATH / _USER
```

### Daily flow

```bash
git push                   # push to origin/main
make deploy                # rsync secrets + git pull + build + kickstart on target
# or:
make ship                  # build locally first, then deploy
```

`make deploy` does: snapshot target's `data/pilot.sqlite` back to `secrets/backups/<utc>/` (safety), `ssh target`, `git reset --hard origin/main`, rsync `secrets/server.env`, `npm install` (if `package-lock.json` changed), `npm run build:web`, `launchctl kickstart` the web agent. **Never touches `data/` on the target** — that's prod-owned.

### Expose it publicly with ngrok

Same pattern as the hub's tunnel agent:

```bash
brew install ngrok                    # on target iMac, one-time
ngrok config add-authtoken <token>    # one-time
bash scripts/install_launchagent.sh   # installs both `web` and `tunnel` agents
make tunnel-url                       # print the current public URL
```

The tunnel LaunchAgent keeps ngrok pointed at `127.0.0.1:3002`. On the free plan the URL rotates on each restart. To pin a stable URL on a paid plan:

```bash
NGROK_DOMAIN=mercury-pilot.ngrok.app bash scripts/install_launchagent.sh
```

### Local commands

```bash
make build             # export Expo web bundle to dist/
make web-start         # foreground server on :3002
make install-agent     # install the LaunchAgent(s)
make status            # check which agents are running
make logs              # tail web + tunnel stdout/stderr
make uninstall-agent   # unload + remove all plists
make tunnel-url        # extract the current ngrok URL from logs
```

---

## Triggering an ESM check-in

The server exposes `POST /api/admin/esm-trigger`, gated by `MERCURY_ADMIN_TOKEN` from `secrets/server.env`. Broadcast to all participants with a registered push token:

```bash
curl -X POST https://<public-url>/api/admin/esm-trigger \
  -H "x-admin-token: $MERCURY_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"slug":"baseline","title":"Check-in time","body":"Got 30 seconds?"}'
```

Or to a subset of participant ids:

```bash
... -d '{"slug":"baseline","participantIds":[1,2,5]}'
```

To schedule recurring triggers, add a cron / LaunchAgent on the source Mac that hits this endpoint on a schedule. Push notifications only fire on native iOS/Android builds — on web, participants use the **Take check-in** button on the chat screen.

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

Supported question types: `likert` (with optional `min_label`/`max_label`), `text`, `choice` (with `multiple` flag). Set `optional: true` to allow blank answers.

---

## Pulling data into the ai-teen analysis pipeline

From the source Mac:

```bash
scp marxs-imac:~/Research/projects/mercury/data/pilot.sqlite ./data/
./scripts/export_data.sh
```

Writes `data-export/participants.csv`, `messages.csv`, `esm_responses.csv`, `esm_surveys.csv`. Feed those into `ai-teen/extract_conversations.py` or query directly — same participant ids across files. No shared code or schema between the two projects by design.

---

## Going to iOS / Android for real users

The web build is enough for early piloting. For TestFlight / Play Console:

```bash
npm install -g eas-cli
eas login
eas build:configure        # writes eas.json, tied to an EAS project id
eas build --platform ios
eas build --platform android
```

Once the EAS project exists:

1. Add its id to [app.json](app.json) under `extra.eas.projectId` so `expo-notifications` can fetch a push token.
2. Set `EXPO_PUBLIC_API_URL` in the build environment to the public ngrok URL (or a stable domain in front of it), so native clients hit the right server.

---

## Safety notes

- The SQLite DB lives only on the iMac at `data/pilot.sqlite`. It's never pushed from source — `make deploy` snapshots a copy *back* to the source (`secrets/backups/<utc>/`) before each deploy.
- The Azure OpenAI key is only in `secrets/server.env` on machines that run the server. `secrets/` is gitignored and rsynced source→target with `chmod 600`.
- The system prompt in [server/server.mjs](server/server.mjs) nudges the model toward age-appropriate replies and flags distress. Review and adjust before deploying to real participants.
- Auth is opaque Bearer tokens issued on enrollment; tokens persist in `AsyncStorage` on the device. No passwords — the participant-code acts as a pre-shared identifier. Suitable for a small pilot; not suitable for hostile users.
- Consent is a single checkbox today. For IRB-compliant recruiting, replace the enrollment screen with a proper assent + parental-consent flow.
