#!/usr/bin/env bash
# Foreground launcher for the mercury-pilot LaunchAgent.
# Runs `next start` on :3002. Assumes `next build` already produced .next/.
# launchd expects the child to stay in the foreground — no nohup/&.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

# launchd starts services with a bare PATH. Poke around for node.
if [[ -n "${MERCURY_PILOT_NODE_PATH:-}" ]]; then
  export PATH="$MERCURY_PILOT_NODE_PATH:$PATH"
elif [[ -d /Users/marx/.nvm/versions/node/v22.22.2/bin ]]; then
  export PATH="/Users/marx/.nvm/versions/node/v22.22.2/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
elif [[ -x /opt/homebrew/bin/node ]]; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
else
  export PATH="/usr/local/bin:/usr/bin:/bin"
fi

# Server env (Azure key, admin token, usage-log path). Missing is OK for a
# smoke test — /api/chat will return 503 until AZURE_OPENAI_* is set.
if [[ -f "$HERE/secrets/server.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$HERE/secrets/server.env"
  set +a
fi

export PORT="${MERCURY_PILOT_PORT:-3002}"
export HOST="${MERCURY_PILOT_HOST:-127.0.0.1}"
export NODE_ENV=production

exec npx --yes next start -p "$PORT" -H "$HOST"
