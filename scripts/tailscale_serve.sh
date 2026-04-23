#!/usr/bin/env bash
# Register mercury-pilot under /pilot on the shared Tailscale Funnel.
# Idempotent: re-running updates the mount in place.
#
# Run once on the target iMac. The config persists across reboots, so this
# isn't a LaunchAgent — just a one-time (or redeploy-once) command.
#
# End result: https://<machine>.<tailnet>.ts.net/pilot → :3002
# Path stripping is handled by tailscale — Express still sees plain /api/*
# and /_expo/* paths, so no server-side code changes needed.
#
# NOTE: we intentionally use `tailscale funnel` rather than `tailscale serve`.
# `serve` exposes only within the tailnet; `funnel` is the public-internet
# mode. Using `serve` with --set-path will silently disable funnel on the
# whole hostname, which also breaks the hub's public access. See
# https://tailscale.com/kb/1247/funnel-serve-use-cases.
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

echo "── registering ${MOUNT} → http://127.0.0.1:${PORT}  (public via funnel)"
"$TS" funnel --bg --https=443 --set-path="$MOUNT" "http://127.0.0.1:$PORT"

echo
echo "── current serve/funnel config:"
"$TS" serve status | sed 's/^/  /'
