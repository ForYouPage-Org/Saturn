SHELL := /usr/bin/env bash
UID := $(shell id -u)
LABEL_WEB := com.mercury.pilot.web

.PHONY: help install dev build start web-start deploy ship install-agent uninstall-agent tailscale-serve logs status typecheck

help:
	@echo "Mercury pilot — Next.js + assistant-ui. Targets:"
	@echo "  install         npm install (first time or after package.json change)"
	@echo "  dev             next dev on 127.0.0.1:3002 (MERCURY_BASE_PATH= to serve at /)"
	@echo "  build           next build — produces .next/"
	@echo "  start           next start on 127.0.0.1:3002 (reads secrets/server.env)"
	@echo "  web-start       alias for start, via scripts/run_web.sh"
	@echo "  install-agent   install LaunchAgent that keeps next start running"
	@echo "  uninstall-agent unload and remove the LaunchAgent"
	@echo "  tailscale-serve register /pilot mount on the shared Tailscale Funnel"
	@echo "  deploy          rsync + rebuild on target iMac, kickstart the agent"
	@echo "  ship            build locally, then deploy"
	@echo "  logs            tail LaunchAgent stdout/stderr"
	@echo "  status          show LaunchAgent status"
	@echo "  typecheck       tsc --noEmit"

install:
	npm install --no-audit --no-fund

dev:
	MERCURY_BASE_PATH= npx next dev -p 3002

build:
	npx next build

start:
	bash scripts/run_web.sh

web-start: start

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
