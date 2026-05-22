#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  ByteBudd — start.sh
#  Starts all containers and optionally runs first-time setup.
#
#  Usage:
#    ./start.sh              # normal start (dev mode)
#    ./start.sh --prod       # start with production overrides
#    ./start.sh --build      # force rebuild images before starting
#    ./start.sh --init       # run migrations + create admin after start
#    ./start.sh --prod --build --init   # combine flags freely
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Flags ────────────────────────────────────────────────────────────────────
PROD=false
BUILD=false
INIT=false

for arg in "$@"; do
  case $arg in
    --prod)  PROD=true  ;;
    --build) BUILD=true ;;
    --init)  INIT=true  ;;
    --help|-h)
      echo ""
      echo "  Usage: ./start.sh [OPTIONS]"
      echo ""
      echo "  Options:"
      echo "    --prod    Use production compose overrides (docker-compose.prod.yml)"
      echo "    --build   Force rebuild all Docker images"
      echo "    --init    Run DB migrations and create admin user after start"
      echo "    --help    Show this help message"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${RESET}"
      echo "Run ./start.sh --help for usage."
      exit 1
      ;;
  esac
done

# ── Resolve script directory so it works from anywhere ───────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║        ByteBudd — Starting Up        ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${RESET}"
echo ""

# ── Check prerequisites ───────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${RED}✗ Docker is not installed or not in PATH.${RESET}"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo -e "${RED}✗ Docker Compose v2 is not available. Update Docker Desktop or install the plugin.${RESET}"
  exit 1
fi

# ── Check .env file ───────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠  No .env file found. Copying from .env.example...${RESET}"
  cp .env.example .env
  echo -e "${YELLOW}   Edit .env and change SECRET_KEY and ENCRYPTION_KEY before going to production.${RESET}"
  echo ""
fi

# ── Build compose command ─────────────────────────────────────────────────────
COMPOSE_CMD="docker compose -f docker-compose.yml"
if $PROD; then
  COMPOSE_CMD="$COMPOSE_CMD -f docker-compose.prod.yml"
  echo -e "${YELLOW}  Mode: ${BOLD}production${RESET}"
else
  echo -e "${GREEN}  Mode: ${BOLD}development${RESET}"
fi

BUILD_FLAG=""
if $BUILD; then
  BUILD_FLAG="--build"
  echo -e "  Images will be rebuilt from scratch."
fi

echo ""

# ── Start containers ──────────────────────────────────────────────────────────
echo -e "${BOLD}[1/3] Starting containers...${RESET}"
$COMPOSE_CMD up -d $BUILD_FLAG
echo -e "${GREEN}      ✓ Containers started${RESET}"
echo ""

# ── Wait for backend to be healthy ───────────────────────────────────────────
echo -e "${BOLD}[2/3] Waiting for backend to be ready...${RESET}"
MAX_WAIT=60
WAITED=0
until docker compose exec -T backend python -c "import sys; sys.exit(0)" &>/dev/null; do
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "${RED}      ✗ Backend did not become ready in ${MAX_WAIT}s. Check logs:${RESET}"
    echo -e "        docker compose logs backend"
    exit 1
  fi
  printf "."
  sleep 2
  WAITED=$((WAITED + 2))
done
echo ""
echo -e "${GREEN}      ✓ Backend is ready${RESET}"
echo ""

# ── Optional init (migrations + admin) ───────────────────────────────────────
if $INIT; then
  echo -e "${BOLD}[3/3] Running first-time setup...${RESET}"

  echo "      → Running database migrations..."
  docker compose exec -T backend alembic upgrade head
  echo -e "${GREEN}        ✓ Migrations applied${RESET}"

  echo "      → Creating admin user..."
  docker compose exec -T backend python scripts/create_admin.py
  echo -e "${GREEN}        ✓ Admin user ready${RESET}"

  echo ""
else
  echo -e "${BOLD}[3/3] Skipping init${RESET} (pass --init to run migrations + create admin)"
  echo ""
fi

# ── Status summary ────────────────────────────────────────────────────────────
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║         ByteBudd is running!         ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}App:${RESET}      http://localhost"
echo -e "  ${BOLD}API docs:${RESET} http://localhost/api/docs"
echo ""
echo -e "  ${BOLD}Useful commands:${RESET}"
echo -e "    docker compose logs -f backend     # stream backend logs"
echo -e "    docker compose logs -f frontend    # stream frontend logs"
echo -e "    docker compose ps                  # check container status"
echo -e "    ./stop.sh                          # stop everything"
echo ""
