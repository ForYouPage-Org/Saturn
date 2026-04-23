#!/usr/bin/env bash
# First-run on a fresh Mac (source or target).
# Safe to re-run. Installs deps, builds the web bundle.
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

# 2. Dependencies.
echo "── npm install"
npm install --no-audit --no-fund

# 3. Env check.
if [[ ! -f .env ]]; then
  echo
  echo "!! .env is missing. Before building, copy .env.example to .env and fill in:"
  echo "     EXPO_PUBLIC_SUPABASE_URL"
  echo "     EXPO_PUBLIC_SUPABASE_ANON_KEY"
  echo "   (these get bundled into the web output at build time)."
  echo
  echo "   Then re-run: bash setup.sh"
  exit 0
fi

# 4. Build web bundle.
echo "── build web bundle → dist/"
npm run build:web

# 5. Logs dir for the LaunchAgent.
mkdir -p logs

echo
echo "── done @ $(ts)"
echo
echo "Next:"
echo "  bash scripts/install_launchagent.sh     # keep static server running on :${MERCURY_PILOT_PORT:-3002}"
echo "  make status                             # verify it's up"
echo "  make logs                               # tail output"
