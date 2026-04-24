#!/usr/bin/env bash
# Install / reinstall the mercury-pilot web LaunchAgent. Idempotent.
#
# Only one agent to manage — com.mercury.pilot.web (static + API on :3002).
# Public exposure is handled by the shared Tailscale Funnel on the target iMac
# (see scripts/tailscale_serve.sh); no separate tunnel process needed.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL=com.mercury.pilot.web
TEMPLATE="$HERE/config/$LABEL.plist.template"
DST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$HOME/Library/LaunchAgents" "$HERE/logs"
chmod +x "$HERE/scripts/run_web.sh" "$HERE/server/server.mjs" 2>/dev/null || true

if [[ ! -f "$TEMPLATE" ]]; then
  echo "!! missing template at $TEMPLATE"
  exit 1
fi
if [[ ! -d "$HERE/.next" ]]; then
  echo "!! no .next/ directory yet — run \`make build\` first"
  exit 1
fi

# Proactively uninstall the retired tunnel agent if a prior install left it
# behind — otherwise it'll keep flapping ngrok against a port no one watches.
LEGACY_TUNNEL=com.mercury.pilot.tunnel
if launchctl print "gui/$(id -u)/$LEGACY_TUNNEL" &>/dev/null; then
  echo "── evicting legacy tunnel agent ($LEGACY_TUNNEL)"
  launchctl bootout "gui/$(id -u)/$LEGACY_TUNNEL" 2>/dev/null || true
  rm -f "$HOME/Library/LaunchAgents/$LEGACY_TUNNEL.plist"
fi

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
sleep 1
sed "s|__MERCURY_ROOT__|${HERE}|g" "$TEMPLATE" > "$DST"
launchctl bootstrap "gui/$(id -u)" "$DST"
launchctl enable "gui/$(id -u)/$LABEL"

echo "installed $DST"
echo
echo "status:"
launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null \
  | awk '/^\tstate =|^\tpid =|^\tlast exit code =/ {sub(/^\t/, ""); printf "  %s\n", $0}' \
  || echo "  (not loaded)"
