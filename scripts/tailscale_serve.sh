#!/usr/bin/env bash
# Register mercury-pilot with Tailscale Serve on the iMac.
# Idempotent: re-running updates the mount in place.
#
# Run once on the target iMac. The config persists across reboots, so this
# isn't a LaunchAgent — just a one-time (or redeploy-once) command.
#
# End result: https://<this-machine>.<tailnet>.ts.net/pilot → :3002
# Path stripping is handled by tailscale — Express still sees plain /api/*
# and /_expo/* paths, so no server-side code changes needed.
set -euo pipefail

MOUNT="${MERCURY_PILOT_MOUNT:-/pilot}"
PORT="${MERCURY_PILOT_PORT:-3002}"

# Tailscale CLI isn't on the bare PATH on macOS; find the binary.
if [[ -x /usr/local/bin/tailscale ]]; then
  TS=/usr/local/bin/tailscale
elif [[ -x /opt/homebrew/bin/tailscale ]]; then
  TS=/opt/homebrew/bin/tailscale
elif [[ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]]; then
  TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale
else
  echo "!! tailscale CLI not found — make sure Tailscale is installed."
  exit 1
fi

echo "── registering ${MOUNT} → http://127.0.0.1:${PORT}  (via $TS)"
"$TS" serve --bg --https=443 --set-path="$MOUNT" "http://127.0.0.1:$PORT"

echo
echo "── current serve config:"
"$TS" serve status | sed 's/^/  /'
