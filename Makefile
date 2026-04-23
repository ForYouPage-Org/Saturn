SHELL := /usr/bin/env bash
UID := $(shell id -u)
LABEL_WEB := com.mercury.pilot.web
LABEL_TUNNEL := com.mercury.pilot.tunnel

.PHONY: help install build build-web web-start deploy ship install-agent uninstall-agent logs status typecheck

help:
	@echo "Mercury pilot — targets:"
	@echo "  install         npm install (first time or after package.json change)"
	@echo "  build           alias for build-web"
	@echo "  build-web       export static web bundle to dist/"
	@echo "  web-start       run the static server in the foreground (for dev / smoke test)"
	@echo "  install-agent   install LaunchAgent that keeps the static server running"
	@echo "  uninstall-agent unload and remove the LaunchAgent"
	@echo "  deploy          rsync + rebuild on the target iMac, then kickstart the agent"
	@echo "  ship            build locally, then deploy"
	@echo "  logs            tail LaunchAgent stdout/stderr"
	@echo "  status          show LaunchAgent status"
	@echo "  typecheck       tsc --noEmit"

install:
	npm install --no-audit --no-fund

build: build-web

build-web:
	npm run build:web

db-init:
	npm run db:init

web-start:
	bash scripts/run_web.sh

deploy:
	bash scripts/push_and_deploy.sh

ship: build deploy

install-agent:
	bash scripts/install_launchagent.sh

uninstall-agent:
	-launchctl bootout gui/$(UID)/$(LABEL_WEB) 2>/dev/null || true
	-launchctl bootout gui/$(UID)/$(LABEL_TUNNEL) 2>/dev/null || true
	-rm -f "$$HOME/Library/LaunchAgents/$(LABEL_WEB).plist" "$$HOME/Library/LaunchAgents/$(LABEL_TUNNEL).plist"
	@echo "uninstalled $(LABEL_WEB) + $(LABEL_TUNNEL)"

logs:
	@mkdir -p logs
	@tail -F logs/web.stdout.log logs/web.stderr.log logs/tunnel.stdout.log logs/tunnel.stderr.log

status:
	@for L in $(LABEL_WEB) $(LABEL_TUNNEL); do \
	  printf "  %-32s " "$$L"; \
	  launchctl print "gui/$(UID)/$$L" 2>/dev/null | awk '/state =|pid =|last exit code =/ { sub(/^\t/,""); printf "%s  ", $$0 }' || printf "(not loaded)"; \
	  echo; \
	done

tunnel-url:
	@grep -oE 'https://[a-z0-9-]+\.ngrok(-free)?\.app' logs/tunnel.stdout.log 2>/dev/null | tail -1 || echo "no tunnel URL yet — check make logs"

typecheck:
	npx tsc --noEmit
