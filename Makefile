SHELL := /usr/bin/env bash
UID := $(shell id -u)
LABEL_WEB := com.mercury.pilot.web

.PHONY: help install build build-web db-init web-start deploy ship install-agent uninstall-agent tailscale-serve logs status typecheck

help:
	@echo "Mercury pilot — targets:"
	@echo "  install         npm install (first time or after package.json change)"
	@echo "  build           alias for build-web"
	@echo "  build-web       export static web bundle to dist/"
	@echo "  web-start       run the static server in the foreground (for dev / smoke test)"
	@echo "  install-agent   install LaunchAgent that keeps the server running"
	@echo "  uninstall-agent unload and remove the LaunchAgent"
	@echo "  tailscale-serve register /pilot mount on the shared Tailscale Funnel"
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
	-rm -f "$$HOME/Library/LaunchAgents/$(LABEL_WEB).plist"
	@echo "uninstalled $(LABEL_WEB)"

tailscale-serve:
	bash scripts/tailscale_serve.sh

logs:
	@mkdir -p logs
	@tail -F logs/web.stdout.log logs/web.stderr.log

status:
	@printf "  %-32s " "$(LABEL_WEB)"
	@launchctl print "gui/$(UID)/$(LABEL_WEB)" 2>/dev/null | awk '/state =|pid =|last exit code =/ { sub(/^\t/,""); printf "%s  ", $$0 }' || printf "(not loaded)"
	@echo

typecheck:
	npx tsc --noEmit
