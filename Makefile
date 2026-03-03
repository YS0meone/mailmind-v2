.PHONY: help setup up down backend frontend dev dev-docker dev-docker-down migrate migration lint format test clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ── Setup ──────────────────────────────────────────────

setup: ## First-time setup: install all dependencies
	docker compose up -d
	cd backend && uv sync --extra dev
	cd frontend && pnpm install
	@echo "\n✅ Setup complete. Copy .env.example files to .env and fill in credentials."

# ── Infrastructure ─────────────────────────────────────

up: ## Start PostgreSQL + Qdrant
	docker compose up -d

down: ## Stop PostgreSQL + Qdrant
	docker compose down

# ── Dev servers ────────────────────────────────────────

backend: ## Start FastAPI dev server (port 8000)
	cd backend && uv run fastapi dev app/main.py

frontend: ## Start Next.js dev server (port 3000)
	cd frontend && pnpm dev

dev: ## Start docker, then run 'make backend' and 'make frontend' in separate terminals
	docker compose up -d
	@echo ""
	@echo "✅ Docker services started."
	@echo ""
	@echo "Now open two terminals and run:"
	@echo "  make backend    # terminal 1"
	@echo "  make frontend   # terminal 2"

dev-docker: ## Start full stack in Docker (all services including backend + frontend)
	docker compose --profile dev up -d --build

dev-docker-down: ## Stop full stack
	docker compose --profile dev down

dev-docker-logs: ## Tail logs from all Docker services
	docker compose --profile dev logs -f

# ── Database ───────────────────────────────────────────

migrate: ## Run all pending migrations
	cd backend && uv run alembic upgrade head

migration: ## Create a new migration (usage: make migration msg="add emails table")
	cd backend && uv run alembic revision --autogenerate -m "$(msg)"

# ── Code quality ───────────────────────────────────────

lint: ## Lint backend + frontend
	cd backend && uv run ruff check .
	cd frontend && pnpm lint

format: ## Format backend code
	cd backend && uv run ruff format .

test: ## Run backend tests
	cd backend && uv run pytest

# ── Cleanup ────────────────────────────────────────────

clean: ## Remove all generated files and containers
	docker compose down -v
	rm -rf backend/.venv frontend/.next frontend/node_modules
