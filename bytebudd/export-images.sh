#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  ByteBudd — export-images.sh
#
#  Exports the built Docker images (backend + frontend) to a single .tar.gz
#  archive so they can be transferred to another machine and imported without
#  needing to rebuild from scratch.
#
#  Usage:
#    ./export-images.sh                        # saves to ./bytebudd-images.tar.gz
#    ./export-images.sh -o /path/to/file.tar.gz  # custom output path
#    ./export-images.sh --help
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Defaults ─────────────────────────────────────────────────────────────────
OUTPUT="bytebudd-images.tar.gz"
IMAGES=(
  "bytebudd-backend:latest"
  "bytebudd-frontend:latest"
)

# ── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    -o|--output)
      OUTPUT="$2"
      shift 2
      ;;
    --help|-h)
      echo ""
      echo "  Usage: ./export-images.sh [OPTIONS]"
      echo ""
      echo "  Options:"
      echo "    -o, --output <file>   Output file path (default: bytebudd-images.tar.gz)"
      echo "    --help                Show this help message"
      echo ""
      echo "  Examples:"
      echo "    ./export-images.sh"
      echo "    ./export-images.sh -o /tmp/bytebudd-images.tar.gz"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${RESET}"
      echo "Run ./export-images.sh --help for usage."
      exit 1
      ;;
  esac
done

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║     ByteBudd — Export Docker Images  ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${RESET}"
echo ""

# ── Check Docker ─────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${RED}✗ Docker is not installed or not in PATH.${RESET}"
  exit 1
fi

# ── Verify images exist ───────────────────────────────────────────────────────
echo -e "${BOLD}[1/3] Checking images...${RESET}"
MISSING=()
for img in "${IMAGES[@]}"; do
  if docker image inspect "$img" &>/dev/null; then
    SIZE=$(docker image inspect "$img" --format='{{.Size}}' | awk '{printf "%.0f MB", $1/1024/1024}')
    echo -e "      ${GREEN}✓${RESET} $img  (${SIZE})"
  else
    echo -e "      ${RED}✗ $img — not found${RESET}"
    MISSING+=("$img")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo -e "${RED}Some images are missing. Build them first:${RESET}"
  echo -e "  cd bytebudd && docker compose up --build -d"
  exit 1
fi

echo ""

# ── Export ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}[2/3] Exporting images to:${RESET} ${OUTPUT}"
echo -e "      Images: ${IMAGES[*]}"
echo -e "      This may take a minute..."
echo ""

docker save "${IMAGES[@]}" | gzip > "$OUTPUT"

# ── Summary ───────────────────────────────────────────────────────────────────
FILE_SIZE=$(du -sh "$OUTPUT" | cut -f1)

echo -e "${BOLD}[3/3] Done.${RESET}"
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║           Export Complete!           ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}File:${RESET}  $OUTPUT"
echo -e "  ${BOLD}Size:${RESET}  $FILE_SIZE"
echo ""
echo -e "  ${BOLD}To transfer to another machine:${RESET}"
echo -e "    scp $OUTPUT user@remote-host:/destination/"
echo ""
echo -e "  ${BOLD}To import on the other machine:${RESET}"
echo -e "    docker load -i $OUTPUT"
echo -e "    docker compose up -d"
echo ""
