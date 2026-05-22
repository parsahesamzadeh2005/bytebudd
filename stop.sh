#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  ByteBudd — stop.sh
#  Stops all containers, with options to clean up volumes and images.
#
#  Usage:
#    ./stop.sh               # stop containers, keep data volumes
#    ./stop.sh --clean       # stop + remove volumes (DELETES all DB data)
#    ./stop.sh --purge       # stop + remove volumes + remove built images
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
CLEAN=false
PURGE=false

for arg in "$@"; do
  case $arg in
    --clean) CLEAN=true ;;
    --purge) PURGE=true; CLEAN=true ;;
    --help|-h)
      echo ""
      echo "  Usage: ./stop.sh [OPTIONS]"
      echo ""
      echo "  Options:"
      echo "    (none)    Stop containers, keep all data volumes intact"
      echo "    --clean   Stop containers AND delete all data volumes"
      echo "              WARNING: this permanently deletes the database!"
      echo "    --purge   --clean + also remove built Docker images"
      echo "    --help    Show this help message"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${RESET}"
      echo "Run ./stop.sh --help for usage."
      exit 1
      ;;
  esac
done

# ── Resolve script directory ──────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║        ByteBudd — Shutting Down      ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${RESET}"
echo ""

# ── Warn about destructive flags ─────────────────────────────────────────────
if $CLEAN; then
  echo -e "${RED}${BOLD}  ⚠  WARNING: --clean will permanently delete all database volumes.${RESET}"
  echo -e "${RED}     This includes all users, connections, and conversation history.${RESET}"
  echo ""
  read -r -p "  Are you sure? Type 'yes' to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo ""
    echo "  Aborted."
    exit 0
  fi
  echo ""
fi

# ── Stop containers ───────────────────────────────────────────────────────────
if $CLEAN; then
  echo -e "${BOLD}Stopping containers and removing volumes...${RESET}"
  docker compose down -v
  echo -e "${GREEN}✓ Containers stopped and volumes removed${RESET}"
else
  echo -e "${BOLD}Stopping containers (data volumes preserved)...${RESET}"
  docker compose down
  echo -e "${GREEN}✓ Containers stopped${RESET}"
fi

# ── Remove images if --purge ──────────────────────────────────────────────────
if $PURGE; then
  echo ""
  echo -e "${BOLD}Removing built images...${RESET}"
  # Remove images built by this project (backend and frontend)
  docker compose down --rmi local 2>/dev/null || true
  echo -e "${GREEN}✓ Local images removed${RESET}"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
if $CLEAN; then
  echo -e "  All containers and data have been removed."
  echo -e "  Run ${BOLD}./start.sh --init${RESET} to start fresh."
else
  echo -e "  All containers stopped. Data volumes are intact."
  echo -e "  Run ${BOLD}./start.sh${RESET} to start again."
fi
echo ""
