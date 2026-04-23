#!/usr/bin/env bash
# Install / reinstall mercury-pilot LaunchAgents. Idempotent.
#
# Installs:
#   com.mercury.pilot.web     — static server on :3002 (always)
#   com.mercury.pilot.tunnel  — ngrok tunnel (only if config template present
#                                AND ngrok is on PATH)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABELS=(com.mercury.pilot.web com.mercury.pilot.tunnel)

mkdir -p "$HOME/Library/LaunchAgents" "$HERE/logs"
chmod +x "$HERE/scripts/run_web.sh" "$HERE/scripts/run_tunnel.sh" "$HERE/scripts/static-server.mjs" 2>/dev/null || true

if [[ ! -d "$HERE/dist" ]]; then
  echo "!! no dist/ directory yet — run \`make build\` first"
  exit 1
fi

for LABEL in "${LABELS[@]}"; do
  TEMPLATE="$HERE/config/$LABEL.plist.template"
  DST="$HOME/Library/LaunchAgents/$LABEL.plist"

  if [[ ! -f "$TEMPLATE" ]]; then
    echo "skip $LABEL (no template at $TEMPLATE)"
    continue
  fi

  # Skip the tunnel agent if ngrok isn't installed on this machine — web
  # is local-only on this mac, no need to expose it.
  if [[ "$LABEL" == "com.mercury.pilot.tunnel" ]] && \
     ! command -v ngrok >/dev/null && \
     [[ ! -x /opt/homebrew/bin/ngrok && ! -x /usr/local/bin/ngrok ]]; then
    echo "skip $LABEL (ngrok not installed — brew install ngrok if you want a public URL)"
    continue
  fi

  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  sleep 1
  sed "s|__MERCURY_ROOT__|${HERE}|g" "$TEMPLATE" > "$DST"
  launchctl bootstrap "gui/$(id -u)" "$DST"
  launchctl enable "gui/$(id -u)/$LABEL"
  echo "installed $DST"
done

echo
echo "status:"
for LABEL in "${LABELS[@]}"; do
  printf "  %-32s " "$LABEL"
  launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null \
    | awk '/^\tstate =|^\tpid =|^\tlast exit code =/ {sub(/^\t/, ""); printf "%s  ", $0}' \
    || echo "(not loaded)"
  echo
done
