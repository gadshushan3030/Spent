# Spent — local personal finance tracker
# Run `make` or `make help` to see available targets.

.DEFAULT_GOAL := help
SHELL := /bin/bash

# Allow `make sync` etc. without npm noise.
NPM := npm

##@ General

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make \033[36m<target>\033[0m\n"} \
		/^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)

##@ Development

.PHONY: install
install: ## Install dependencies
	$(NPM) install

.PHONY: dev
dev: ## Start the dev server (127.0.0.1:3000)
	$(NPM) run dev

.PHONY: build
build: ## Production build
	$(NPM) run build

.PHONY: start
start: ## Start the production server (127.0.0.1:41234)
	$(NPM) run start

##@ Quality

.PHONY: typecheck
typecheck: ## Type-check without emitting
	npx tsc --noEmit

.PHONY: lint
lint: ## Run eslint
	$(NPM) run lint

.PHONY: check
check: typecheck lint ## Type-check and lint

.PHONY: audit
audit: ## Audit production dependencies
	$(NPM) run security:audit

.PHONY: outdated
outdated: ## List outdated dependencies
	$(NPM) run security:outdated

##@ Database

.PHONY: db-reset
db-reset: ## Delete the local DB and encryption key (next run reseeds)
	rm -f data/spent.db data/spent.db-wal data/spent.db-shm data/.encryption-key
	@echo "Local database cleared. It will be recreated on next start."

.PHONY: db-backup
db-backup: ## Snapshot the DB to data/spent.backup-<timestamp>.db
	@cp data/spent.db data/spent.backup-$$(date +%Y%m%d-%H%M%S).db && \
		echo "Backup written to data/"

##@ Service (background runner)

.PHONY: service-install
service-install: ## Install Spent as a background service
	$(NPM) run service:install

.PHONY: service-start
service-start: ## Start the background service
	$(NPM) run service:start

.PHONY: service-stop
service-stop: ## Stop the background service
	$(NPM) run service:stop

.PHONY: service-status
service-status: ## Show background service status
	$(NPM) run service:status

.PHONY: service-logs
service-logs: ## Tail background service logs
	$(NPM) run service:logs

##@ Housekeeping

.PHONY: clean
clean: ## Remove build artifacts and caches
	rm -rf .next node_modules/.cache
	@echo "Removed .next and caches."

.PHONY: reset
reset: clean ## Full reset: remove artifacts and node_modules
	rm -rf node_modules
	@echo "Removed node_modules. Run 'make install' to restore."
