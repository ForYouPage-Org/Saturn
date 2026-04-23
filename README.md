# Mercury

Pilot app for a teen research study. Two things:

1. **A minimal ChatGPT-like chatbot** (web + iOS + Android, one codebase) so teens can chat with an AI assistant and we collect every turn.
2. **Experience sampling (ESM)** — we can push a short check-in survey at any time, and the teen fills it out in the app.

Stack:

- **Expo (React Native)** — one codebase for web, iOS, Android.
- **Supabase** — Postgres (data), auth (anonymous), edge functions (AI proxy + push trigger).
- **Azure OpenAI Responses API** — model backing the chat. Key lives in Supabase edge function secrets, never in the client.

Integration with the `ai-teen` analysis project is intentionally thin: pilot data exports as CSV via `scripts/export_data.sh`, then gets ingested by the existing pipeline.

---

## Layout

```
app/                       # Expo Router screens
  _layout.tsx              # Stack + notification-tap handler
  index.tsx                # Enrollment (code + age + consent)
  chat.tsx                 # ChatGPT-like screen
  esm.tsx                  # ESM form (modal)
lib/                       # Client utilities
  supabase.ts              # Supabase client + types
  auth.ts                  # Anonymous sign-in + participant row
  chat.ts                  # invokes the `chat` edge function
  esm.ts                   # fetches active survey, submits responses
  notifications.ts         # Expo push token registration
supabase/
  migrations/
    20260423000000_init.sql
  functions/
    chat/index.ts          # Azure OpenAI proxy
    esm-trigger/index.ts   # researcher-triggered push broadcast
scripts/
  export_data.sh           # CSV export for the ai-teen pipeline
```

---

## Setup

### 1. Install deps

```bash
cd /Users/marxw/Research/projects/mercury
npm install
```

### 2. Create a Supabase project

Either via the dashboard or the CLI:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

Apply the migration (creates tables + RLS policies + seeds the baseline survey):

```bash
supabase db push
```

### 3. Configure edge function secrets

```bash
# Paste the actual Azure OpenAI key on the command line — do NOT put it in any
# file that gets committed. Same for any future keys.
supabase secrets set \
  AZURE_OPENAI_API_KEY='<paste-key-here>' \
  AZURE_OPENAI_BASE_URL=https://nexhelm-ai-marx.openai.azure.com/openai/v1 \
  AZURE_OPENAI_MODEL=gpt-5.4 \
  AZURE_OPENAI_API_VERSION=preview
```

Deploy:

```bash
supabase functions deploy chat
supabase functions deploy esm-trigger --no-verify-jwt
```

`--no-verify-jwt` on `esm-trigger` is intentional — that endpoint authenticates by requiring the service-role key in the Authorization header, not a user JWT. It's researcher-only.

### 4. Point the client at your Supabase project

```bash
cp .env.example .env
# fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from the dashboard
```

### 5. Enable anonymous auth

Supabase dashboard → Authentication → Providers → toggle **Anonymous** on.

### 6. Run it

```bash
npm run web          # browser — easiest for development
npm run ios          # iOS simulator (requires Xcode)
npm run android      # Android emulator (requires Android Studio)
```

For real device testing, install **Expo Go** on your phone and scan the QR code from `npm start`.

---

## Triggering an ESM check-in

Send a push to every enrolled participant:

```bash
curl -X POST https://<ref>.functions.supabase.co/esm-trigger \
  -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d '{"slug":"baseline","title":"Check-in time","body":"Got 30 seconds?"}'
```

Or to a subset:

```bash
... -d '{"slug":"baseline","participantIds":["uuid-1","uuid-2"]}'
```

To schedule it automatically (e.g. 3× per day), set up a Supabase Cron entry that hits this endpoint. Push notifications only fire on native iOS/Android builds — on web you'll rely on the in-app "Take check-in" button or route users to `/esm` directly.

### Authoring new surveys

`esm_surveys.questions` is a JSONB column. Insert a new row, and the app will render it automatically:

```sql
insert into public.esm_surveys (slug, title, questions, active) values (
  'end-of-day',
  'End-of-day reflection',
  '[
    {"id":"helpful","type":"likert","prompt":"How helpful was the assistant today?","min":1,"max":7},
    {"id":"topics","type":"choice","prompt":"What did you use it for?","multiple":true,"options":["Homework","Social","Fun"]},
    {"id":"notes","type":"text","prompt":"Anything else?","optional":true}
  ]'::jsonb,
  true
);
```

Supported question types: `likert` (with optional `min_label`/`max_label`), `text`, `choice` (with `multiple` flag). Set `optional: true` to allow blank answers.

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

Once the EAS project exists, add its id to `app.json` under `extra.eas.projectId` so `expo-notifications` can fetch a push token.

---

## Pulling data into the ai-teen analysis pipeline

```bash
./scripts/export_data.sh ./data-export
```

Writes `participants.csv`, `messages.csv`, `esm_responses.csv`. Feed those into `ai-teen/extract_conversations.py` or query directly — same participant ids across files. No shared code or schema between the two projects by design.

---

## Deploying to the iMac (same pattern as `_hub`)

The source Mac (this one) builds + pushes. The target iMac (`marxs-imac` on the Tailscale tailnet) hosts a static server kept alive by a LaunchAgent on port **3002**, same pattern as the hub's port 3001. Both can coexist.

**One-time, on the target iMac:**

```bash
git clone <remote-url> ~/Research/projects/mercury
cd ~/Research/projects/mercury
# copy .env (EXPO_PUBLIC_SUPABASE_URL + anon key) into place
bash setup.sh
bash scripts/install_launchagent.sh
```

Prereqs on target: Node 20+, Tailscale, Remote Login on, source's SSH key in `~/.ssh/authorized_keys`.

**One-time, on the source (this Mac):**

```bash
cp scripts/mercury-pilot-push.env.example ~/.mercury-pilot-push.env
chmod 600 ~/.mercury-pilot-push.env
# edit MERCURY_PILOT_TARGET_HOST / _PATH / _USER as needed
```

**Daily flow:**

```bash
make ship         # commit + push + rebuild + kickstart on target
# or separately:
git push
make deploy
```

`make deploy` does: ssh target, `git reset --hard origin/main`, rsync `.env`, `npm install` (if lockfile changed), `npm run build:web`, `launchctl kickstart` the web agent.

**Expose it publicly with ngrok** (same pattern as the hub's tunnel agent):

```bash
brew install ngrok                    # on target iMac, one-time
ngrok config add-authtoken <token>    # one-time
bash scripts/install_launchagent.sh   # now installs both `web` and `tunnel` agents
make tunnel-url                       # print the current public URL
```

The tunnel LaunchAgent keeps ngrok pointed at `127.0.0.1:3002`. On the free plan the URL rotates on each restart (flaky for distributing to participants). To pin a stable URL on a paid plan:

```bash
NGROK_DOMAIN=mercury-pilot.ngrok.app bash scripts/install_launchagent.sh
```

If ngrok isn't installed on a given Mac, the tunnel agent is skipped automatically (development Macs don't need to expose the port).

**Local commands** (useful on either Mac):

```bash
make build             # export Expo web bundle to dist/
make web-start         # foreground static server on :3002
make install-agent     # install the LaunchAgent
make status            # check if the agent is running
make logs              # tail LaunchAgent stdout/stderr
make uninstall-agent   # unload + remove the plist
```

---

## Safety notes

- RLS is on for every table. Participants can only read their own rows. The service-role key bypasses RLS and is used only inside edge functions.
- The Azure OpenAI key never reaches the client — it lives in Supabase secrets and is used by the `chat` function.
- The system prompt in `supabase/functions/chat/index.ts` nudges the model toward age-appropriate replies and flags distress. Review and adjust before deploying to real participants.
- Consent is a checkbox today. For IRB-compliant recruiting, replace the enrollment screen with a proper assent + parental-consent flow.
