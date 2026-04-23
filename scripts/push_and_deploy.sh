#!/usr/bin/env bash
# Push code + secrets from source → target Mac and rebuild. Runs on the SOURCE.
# Invoked via `make deploy` or `make ship`.
#
# Topology of state on the target:
#   git (immutable code)            ── pushed via `git reset --hard origin/main`
#   secrets/server.env              ── rsynced from source (Azure key, admin)
#   data/pilot.sqlite               ── owned by the target; never overwritten
#   dist/ (web bundle)              ── rebuilt on target
#   LaunchAgents                    ── kickstarted after build
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
  echo "     ssh $REMOTE 'git clone https://github.com/ForYouPage-Org/Saturn.git ${TARGET_PATH}'"
  echo "     ssh $REMOTE 'cd ${TARGET_PATH} && bash setup.sh && bash scripts/install_launchagent.sh'"
  exit 1
fi

# 1. Snapshot target DB back to source/secrets/backups/<utc>/ — non-fatal on
#    first deploys (no pilot.sqlite exists yet).
BACKUP_DIR="$SRC/secrets/backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
echo "── 1. snapshot prod DB → $BACKUP_DIR"
rsync -az "${REMOTE}:${TARGET_PATH}/data/pilot.sqlite" "$BACKUP_DIR/" 2>/dev/null || true
find "$BACKUP_DIR" -type d -empty -delete 2>/dev/null || true

# 2. Push code.
echo "── 2. git pull on target (${BRANCH})"
ssh "$REMOTE" "cd ${TARGET_PATH} && git fetch --quiet origin ${BRANCH} && \
              git reset --hard --quiet origin/${BRANCH} && \
              git rev-parse --short HEAD" \
  | sed 's/^/   target HEAD now /'

# 3. Push secrets/server.env (and .env if present for client-side public vars).
echo "── 3. rsync secrets + .env"
if [[ -f secrets/server.env ]]; then
  rsync -az secrets/server.env "${REMOTE}:${TARGET_PATH}/secrets/server.env"
  ssh "$REMOTE" "chmod 600 ${TARGET_PATH}/secrets/server.env"
  echo "   synced secrets/server.env"
else
  echo "   no local secrets/server.env — target must have its own (see secrets/server.env.example)"
fi
if [[ -f .env ]]; then
  rsync -az .env "${REMOTE}:${TARGET_PATH}/.env"
  ssh "$REMOTE" "chmod 600 ${TARGET_PATH}/.env"
fi

# 4. Rebuild + restart on target.
echo "── 4. rebuild + restart on target"
ssh "$REMOTE" "bash -l -s" <<EOF
set -euo pipefail
cd "${TARGET_PATH}"

if [[ -d /Users/marx/.nvm/versions/node/v22.22.2/bin ]]; then
  export PATH="/Users/marx/.nvm/versions/node/v22.22.2/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
elif [[ -x /opt/homebrew/bin/node ]]; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
fi

if [[ package-lock.json -nt node_modules/.hash ]] || [[ ! -d node_modules ]]; then
  echo "   npm install (rebuilds better-sqlite3 natively for this arch)"
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
