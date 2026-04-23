#!/usr/bin/env bash
# Foreground launcher for the mercury-pilot web LaunchAgent.
# launchd expects the child to stay in the foreground — no nohup/&.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

# launchd starts services with a bare PATH. Poke around for node, preferring
# (in order): the hub's nvm install, Homebrew on Apple Silicon, Intel Homebrew,
# system paths. Override with MERCURY_PILOT_NODE_PATH in the environment.
if [[ -n "${MERCURY_PILOT_NODE_PATH:-}" ]]; then
  export PATH="$MERCURY_PILOT_NODE_PATH:$PATH"
elif [[ -d /Users/marx/.nvm/versions/node/v22.22.2/bin ]]; then
  export PATH="/Users/marx/.nvm/versions/node/v22.22.2/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
elif [[ -x /opt/homebrew/bin/node ]]; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
else
  export PATH="/usr/local/bin:/usr/bin:/bin"
fi

export PORT="${MERCURY_PILOT_PORT:-3002}"
export HOST="${MERCURY_PILOT_HOST:-127.0.0.1}"

exec node scripts/static-server.mjs
