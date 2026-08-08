# Makefile home-connect-mqtt
SHELL := /bin/bash

# --- 1. DYNAMISCHE PARAMETER & VARIABLEN ---
PROJECT_NAME = $(notdir $(CURDIR))
FORGEJO_IP   = 10.1.1.19
FORGEJO_PORT = 3143
FORGEJO_USER = peter
FORGEJO_URL  = http://$(FORGEJO_IP):$(FORGEJO_PORT)/$(FORGEJO_USER)/$(PROJECT_NAME).git

IMAGE := $(shell basename $(CURDIR))
CONTAINER := $(shell basename $(CURDIR))
.DEFAULT_GOAL := help
.PHONY: build up down restart rebuild logs logs-tail ps stop start shell health \
        run fmt lint check testdata cleartestdata import-history simulate \
        webhook-test cloud-login requirements clean clean-mac help \
        testdata-random simulate-dry simulate-slow backup compare

PYTHON := $(shell if [ -f ../.venv/bin/python ]; then echo ../.venv/bin/python; else echo python3; fi)

ptv: ## Get python version and venv status	
	@echo "  Pfad zu Python:    $(PYTHON)"
	@if [ -n "$(VIRTUAL_ENV)" ]; then \
		echo "  Venv aktiv?        JA (Pfad: $(VIRTUAL_ENV))"; \
	else \
		echo "  Venv aktiv?        NEIN (Globales System)"; \
	fi
	@echo -n "  Version:           "
	@$(PYTHON) --version

# ---------------------------------------------------------
# Lokales Ausfuehren
# ---------------------------------------------------------
run: ## Start project locally
	$(PYTHON) main.py

# ---------------------------------------------------------
# Docker
# ---------------------------------------------------------

build: ## Build Docker image
	docker compose build

up: ## Start containers
	docker compose up -d

down: ## Stop containers
	docker compose down

restart: ## Restart containers
	docker compose restart

rebuild: ## Rebuild and restart (no cache)
	docker compose down
	docker compose build --no-cache
	docker compose up -d --force-recreate

logs: ## Show logs (follow)
	docker compose logs -f

logs-tail: ## Last 100 log lines
	docker compose logs --tail=100

ps: ## Running containers
	docker compose ps

stop: ## Stop containers
	docker compose stop

start: ## Start containers
	docker compose start

shell: ## Shell into container
	docker compose exec $(CONTAINER) /bin/bash

health: ## Check container health
	@docker inspect --format='{{.State.Health.Status}}' $(CONTAINER) 2>/dev/null || echo "Container not found"

# ---------------------------------------------------------
# Daten
# ---------------------------------------------------------

testdata: ## Generate 20 test sessions (backs up existing DB)
	$(PYTHON) scripts/testdata.py

testdata-random: ## Generate 90 days random data (backs up existing DB)
	$(PYTHON) scripts/testdata.py --random 90

cleartestdata: ## Restore original DB from backup
	$(PYTHON) scripts/testdata.py --clear

simulate: ## Simulate a dishwasher session (backs up DB)
	$(PYTHON) scripts/simulate.py --fast

simulate-dry: ## Simulate dry-run (nur Ausgabe, keine DB/MQTT)
	$(PYTHON) scripts/simulate.py --dry-run

simulate-slow: ## Simulate with realistic timing
	$(PYTHON) scripts/simulate.py

webhook-test: ## Start local webhook test server (port 8123)
	$(PYTHON) scripts/webhook_test.py

import-history: ## Import data/history.csv into DB
	$(PYTHON) scripts/import_history.py

cloud-login: ## Fetch new device config from Bosch Cloud
	$(PYTHON) -m app.device.cloud_login app/config/bosch_new/devices.json

backup: ## Backup database
	@cp -v data/dishwasher.db data/dishwasher.db.backup
	@echo "Backup created"

# ---------------------------------------------------------
# Code-Qualitaet
# ---------------------------------------------------------

fmt: ## Format code with ruff
	$(PYTHON) -m ruff format .

lint: ## Lint code with ruff
	$(PYTHON) -m ruff check .

lint-fix: ## Lint + auto-fix
	$(PYTHON) -m ruff check --fix .

check: ## Check code with Ruff + Pyright
	@./check.sh --save

requirements: ## Generate requirements.txt
	pipreqs ./ --debug --force --ignore .history,internal,testcase,.venv

# ---------------------------------------------------------
# Clean
# ---------------------------------------------------------

clean: ## Remove cache and build artifacts
	@echo "Cleaning project..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name "*.pyo" -delete 2>/dev/null || true
	@rm -rf .pytest_cache .ruff_cache build dist
	@echo "Done."

clean-mac: ## Remove macOS metadata files
	@find . -name "._*" -delete 2>/dev/null || true
	@find . -name ".DS_Store" -delete 2>/dev/null || true
	@echo "Done."

jsbuild: ## JS + CSS bundlen via Docker & esbuild
	@echo "📦 JS & CSS Bundling via Docker & esbuild..."
	@docker run --rm -v "$$(pwd)":/app -w /app node:20-alpine sh -c "\
		npx esbuild frontend/js/v2/main.js --bundle --minify --sourcemap --format=esm --outfile=frontend/js/v2/main.bundle.js && \
		npx esbuild frontend/css/style.css --bundle --minify --sourcemap --outfile=frontend/css/style.bundle.css"
	@echo "✅ Fertig!"

compare: ## Vergleicht lokale Dateien mit Container-Inhalt
	@mkdir -p /tmp/hc_bosch_files
	@docker cp hc_bosch:/app/. /tmp/hc_bosch_files/
	@echo "─── Geänderte Dateien ───"
	@diff -qr --exclude="__pycache__" --exclude="*.pyc" --exclude=".git" \
		--exclude="data" --exclude="logs" --exclude=".env" --exclude=".ruff_cache" \
		./ /tmp/hc_bosch_files/ 2>/dev/null | sort || true
	@echo ""
	@echo "─── Nur lokal (neu/nicht im Container) ───"
	@diff -qr --exclude="__pycache__" --exclude="*.pyc" --exclude=".git" \
		--exclude="data" --exclude="logs" --exclude=".env" --exclude=".ruff_cache" \
		./ /tmp/hc_bosch_files/ 2>/dev/null | grep "Nur in \./" | sort || true
	@echo ""
	@echo "─── Nur im Container (lokal gelöscht) ───"
	@diff -qr --exclude="__pycache__" --exclude="*.pyc" --exclude=".git" \
		--exclude="data" --exclude="logs" --exclude=".env" --exclude=".ruff_cache" \
		./ /tmp/hc_bosch_files/ 2>/dev/null | grep "Nur in /tmp/" | sort || true
	@rm -rf /tmp/hc_bosch_files

diff-detail: ## Zeigt inhaltliche Unterschiede zum Container
	@mkdir -p /tmp/hc_bosch_files
	@docker cp hc_bosch:/app/. /tmp/hc_bosch_files/
	@diff -ur --exclude="__pycache__" --exclude="*.pyc" --exclude=".git" \
		--exclude="data" --exclude="logs" --exclude=".env" --exclude=".ruff_cache" \
		/tmp/hc_bosch_files/ ./ 2>/dev/null || true
	@rm -rf /tmp/hc_bosch_files

git-status: ## Zeigt die aktuelle Forgejo Server-Verbindung (Remote URL) an
	@echo "🔍 Überprüfe Git-Remote-Konfiguration..."
	@if ! git remote get-url origin >/dev/null 2>&1; then \
		echo "❌ Fehler: 'origin' ist noch nicht eingerichtet!"; \
		echo "👉 Bitte führe aus: make git-setup"; \
		exit 1; \
	fi
	@URL=$$(git remote get-url origin); \
	echo "🍏 Forgejo-Server ist aktiv verbunden!" ; \
	echo "🔗 Aktuelle URL: $$URL"

git-setup: ## Git-Verbindung zum Forgejo-Server automatisch einrichten oder korrigieren
	@echo "🛠️ Initialisiere Forgejo Server-Verbindung für '$(PROJECT_NAME)'..."
	@if ! git remote get-url origin >/dev/null 2>&1; then \
		git remote add origin $(FORGEJO_URL); \
		echo "🎉 Server-URL erfolgreich neu angelegt!"; \
	else \
		git remote set-url origin $(FORGEJO_URL); \
		echo "🔄 Bestehende Server-URL erfolgreich korrigiert!"; \
	fi
	@echo "🔗 Ziel-Adresse: $(FORGEJO_URL)"

git-update: git-status ## Git Forgejo Update durchführen (Normaler Zwischenstand)
	git add -A
	git commit -m "Update am $$(date +'%Y-%m-%d %H:%M')" || true
	git push -u origin main


git-release: git-status ## Neues Versions-Tag automatisch berechnen, erstellen und zu Forgejo pushen
	git add -A
	git commit -m "Release-Vorbereitung am $$(date +'%Y-%m-%d %H:%M')" || true
	git push origin main
	@LAST_TAG=$$(git describe --tags --abbrev=0 2>/dev/null || echo "v2.1.0"); \
	NEXT_TAG=$$(echo $$LAST_TAG | awk -F. '{print $$1"."$$2"."$$3+1}'); \
	echo "🍏 Letzte Version war: $$LAST_TAG"; \
	echo "⚡ Berechnete neue Version: $$NEXT_TAG"; \
	echo "📦 Erstelle Git-Tag $$NEXT_TAG mit aktuellem Zeitstempel..."; \
	git tag -a $$NEXT_TAG -m "Automatisches Release $$NEXT_TAG am $$(date +'%Y-%m-%d %H:%M') via Makefile"; \
	git push origin $$NEXT_TAG; \
	echo "🎉 Version $$NEXT_TAG erfolgreich an Forgejo übermittelt!"

.PHONY: env-example

help: ## Show this help
	@echo ""
	@echo "Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?##' Makefile | awk 'BEGIN {FS = ":.*?##"}; {printf "  %-18s %s\n", $$1, $$2}'
	@echo ""
