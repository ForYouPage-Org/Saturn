#!/usr/bin/env bash
# Push code + .env from this (source) Mac to a target Mac and rebuild.
# Runs on the SOURCE after committing. Invoked via `make deploy` or `make ship`.
#
# Mirrors the topology used by _hub:
#   git (immutable code)   ── pushed to target via `git reset --hard origin/main`
#   .env (EXPO_PUBLIC_…)   ── rsynced from source; needed at build time
#   dist/                  ── rebuilt on target (cheap, avoids arch issues)
#   LaunchAgent            ── kickstarted after build to pick up new bundle
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SRC"

CONF="${HOME}/.mercury-pilot-push.env"
if [[ ! -f "$CONF" ]]; then
  echo "!! missing $CONF — copy example from scripts/mercury-pilot-push.env.example"
  exit 1
fi
# shellcheck disable=SC1090
source "$CONF"

: "${MERCURY_PILOT_TARGET_HOST:?not set in $CONF}"
: "${MERCURY_PILOT_TARGET_PATH:?not set in $CONF}"
SSH_USER="${MERCURY_PILOT_TARGET_USER:-$USER}"
REMOTE="${SSH_USER}@${MERCURY_PILOT_TARGET_HOST}"
TARGET_PATH="${MERCURY_PILOT_TARGET_PATH}"
BRANCH="${MERCURY_PILOT_BRANCH:-main}"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
echo "── push_and_deploy @ $(ts)  →  ${REMOTE}:${TARGET_PATH}"

# 0. Preflight.
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$REMOTE" true 2>/dev/null; then
  echo "!! cannot ssh to $REMOTE — check Tailscale + Remote Login + authorized_keys"
  exit 1
fi
if ! ssh "$REMOTE" "test -d ${TARGET_PATH}/.git" 2>/dev/null; then
  echo "!! target at ${TARGET_PATH} is not a git repo."
  echo "   One-time clone on target:"
  echo "     ssh $REMOTE 'git clone <remote-url> ${TARGET_PATH}'"
  echo "     ssh $REMOTE 'cd ${TARGET_PATH} && bash setup.sh && bash scripts/install_launchagent.sh'"
  exit 1
fi

# 1. Push code. Assumes source has already pushed to origin/${BRANCH}.
echo "── 1. git pull on target (${BRANCH})"
ssh "$REMOTE" "cd ${TARGET_PATH} && git fetch --quiet origin ${BRANCH} && \
              git reset --hard --quiet origin/${BRANCH} && \
              git rev-parse --short HEAD" \
  | sed 's/^/   target HEAD now /'

# 2. Push .env (EXPO_PUBLIC_* keys are baked into the web bundle at build time).
echo "── 2. rsync .env"
if [[ -f .env ]]; then
  rsync -az .env "${REMOTE}:${TARGET_PATH}/.env"
  ssh "$REMOTE" "chmod 600 ${TARGET_PATH}/.env"
  echo "   synced"
else
  echo "   no local .env — skipping (target must have its own)"
fi

# 3. Rebuild + restart on target.
echo "── 3. rebuild + restart on target"
ssh "$REMOTE" "bash -l -s" <<EOF
set -euo pipefail
cd "${TARGET_PATH}"

# Find node (mirrors run_web.sh's logic).
if [[ -d /Users/marx/.nvm/versions/node/v22.22.2/bin ]]; then
  export PATH="/Users/marx/.nvm/versions/node/v22.22.2/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
elif [[ -x /opt/homebrew/bin/node ]]; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
fi

if [[ package-lock.json -nt node_modules/.hash ]] || [[ ! -d node_modules ]]; then
  echo "   npm install"
  npm install --silent --no-audit --no-fund
  mkdir -p node_modules && touch node_modules/.hash
fi

echo "   build web bundle"
npm run build:web --silent

echo "   kickstart LaunchAgent"
launchctl kickstart -k "gui/\$(id -u)/com.mercury.pilot.web" 2>/dev/null || \
  echo "   (agent not installed yet — run bash scripts/install_launchagent.sh on target)"
EOF

echo "── done @ $(ts)"
