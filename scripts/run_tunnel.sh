#!/usr/bin/env bash
# Foreground launcher for the mercury-pilot tunnel LaunchAgent.
# Points ngrok at whatever port the web agent is serving on.
set -euo pipefail

PORT="${MERCURY_PILOT_PORT:-3002}"

# ngrok lives in /opt/homebrew/bin on Apple Silicon, /usr/local/bin on Intel.
if [[ -x /opt/homebrew/bin/ngrok ]]; then
  NGROK=/opt/homebrew/bin/ngrok
elif [[ -x /usr/local/bin/ngrok ]]; then
  NGROK=/usr/local/bin/ngrok
else
  echo "ngrok not found — install with: brew install ngrok" >&2
  exit 1
fi

# Optional: reserved domain for a stable URL across restarts (paid plan).
# export NGROK_DOMAIN=mercury-pilot.ngrok.app
if [[ -n "${NGROK_DOMAIN:-}" ]]; then
  exec "$NGROK" http "$PORT" --domain="$NGROK_DOMAIN" --log=stdout
else
  exec "$NGROK" http "$PORT" --log=stdout
fi
