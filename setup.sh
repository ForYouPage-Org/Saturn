#!/usr/bin/env bash
# First-run on a fresh Mac (source or target). Safe to re-run.
# Installs deps, initialises the SQLite DB, builds the web bundle.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
echo "── mercury-pilot setup @ $(ts)"

# 1. Node present?
if ! command -v node >/dev/null; then
  echo "!! node is not on PATH."
  echo "   Install Node 20+ first:"
  echo "     brew install node@20"
  echo "   or use nvm:"
  echo "     curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo "     nvm install 20"
  exit 1
fi
echo "── node: $(node --version)"

# 2. Dependencies. better-sqlite3 compiles natively; needs Xcode CLT.
echo "── npm install  (rebuilds better-sqlite3 for this machine's arch)"
npm install --no-audit --no-fund

# 3. Secrets check — non-fatal, but /api/chat will fail until AZURE_OPENAI_*
#    is set in secrets/server.env.
mkdir -p secrets
if [[ ! -f secrets/server.env ]]; then
  echo
  echo "⚠ secrets/server.env is missing."
  echo "   Copy secrets/server.env.example and fill in AZURE_OPENAI_API_KEY +"
  echo "   a fresh MERCURY_ADMIN_TOKEN (openssl rand -base64 32)."
  echo "   You can finish this step later; the server will start, just the"
  echo "   /api/chat endpoint will return 'not configured' until you do."
fi

# 4. Initialise SQLite (idempotent — runs schema.sql + seed.sql).
# 4. Ensure data/ exists; the DB is created lazily by the server on first
#    request.
mkdir -p data

# 5. Build Next.js production bundle.
echo "── next build → .next/"
npm run build

# 6. Logs dir for the LaunchAgent.
mkdir -p logs

echo
echo "── done @ $(ts)"
echo
echo "Next:"
echo "  bash scripts/install_launchagent.sh     # keep server running on :${MERCURY_PILOT_PORT:-3002}"
echo "  make status                             # verify it's up"
echo "  make logs                               # tail output"
echo "  curl http://127.0.0.1:${MERCURY_PILOT_PORT:-3002}/api/health"
