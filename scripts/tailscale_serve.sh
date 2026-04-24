#!/usr/bin/env bash
# Register mercury-pilot under /pilot on the shared Tailscale Funnel.
# Idempotent: re-running updates the mount in place.
#
# Next.js's basePath means the server expects to see /pilot/* in the path.
# Pass a target URL that includes /pilot so tailscale preserves the prefix
# on the wire rather than stripping it. Result:
#   browser  →  https://<host>/pilot/foo
#   backend  →  http://127.0.0.1:3002/pilot/foo   (Next.js routes /pilot/foo)
#
# End result: https://<machine>.<tailnet>.ts.net/pilot → Next.js on :3002
#
# NOTE: we intentionally use `tailscale funnel` rather than `tailscale serve`.
# `serve` exposes only within the tailnet; `funnel` is the public-internet
# mode. Using `serve` with --set-path will silently disable funnel on the
# whole hostname, which also breaks the hub's public access.
set -euo pipefail

MOUNT="${MERCURY_PILOT_MOUNT:-/pilot}"
PORT="${MERCURY_PILOT_PORT:-3002}"

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

TARGET_URL="http://127.0.0.1:${PORT}${MOUNT}"
echo "── registering ${MOUNT} → ${TARGET_URL}  (public via funnel, path preserved)"
"$TS" funnel --bg --https=443 --set-path="$MOUNT" "$TARGET_URL"

echo
echo "── current serve/funnel config:"
"$TS" serve status | sed 's/^/  /'
