#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${1:-/opt/sofon}"
COMPOSE_FILE="${INSTALL_DIR}/deploy/docker-compose.prod.yml"
ENV_FILE="${INSTALL_DIR}/.env"
LOG_FILE="${INSTALL_DIR}/deploy.log"

# ── Colour helpers ────────────────────────────────────────────────────────────
RESET='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'

log_header() { printf "\n  ${BOLD}%s${RESET}\n\n" "$*"; }
log_ok()     { printf "  ${GREEN}✓${RESET}  %s\n" "$*"; }
log_warn()   { printf "  ${YELLOW}!${RESET}  %s\n" "$*"; }
log_error()  { printf "  ${RED}✗  %s${RESET}\n" "$*" >&2; }
log_dim()    { printf "  ${DIM}  %s${RESET}\n" "$*"; }

# ── Spinner ───────────────────────────────────────────────────────────────────
_SPIN_PID=""
_FRAMES=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

spinner_start() {
  local msg="$1"
  ( i=0
    while true; do
      printf "\r  ${CYAN}%s${RESET}  %s   " "${_FRAMES[$i]}" "${msg}"
      i=$(( (i+1) % 10 ))
      sleep 0.1
    done
  ) 2>/dev/null &
  _SPIN_PID=$!
}

spinner_stop() {
  [[ -n "${_SPIN_PID}" ]] && { kill "${_SPIN_PID}" 2>/dev/null; wait "${_SPIN_PID}" 2>/dev/null || true; _SPIN_PID=""; }
  printf "\r%-72s\r" " "
  [[ "${1:-0}" -eq 0 ]] && log_ok "$2" || log_error "$2"
}

_cleanup() { [[ -n "${_SPIN_PID}" ]] && kill "${_SPIN_PID}" 2>/dev/null || true; }
trap _cleanup EXIT

# ── Pre-flight ────────────────────────────────────────────────────────────────
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Deploying Sofon"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  log_error "Missing compose file: ${COMPOSE_FILE}"; exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  log_error "Missing env file: ${ENV_FILE}"; exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  log_error "Docker is not installed."; exit 1
fi

cd "${INSTALL_DIR}"
_compose="docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE}"

# ── Pull images ───────────────────────────────────────────────────────────────
spinner_start "Pulling Docker images (this may take a few minutes on first run)..."
if ${_compose} pull >>"${LOG_FILE}" 2>&1; then
  spinner_stop 0 "Images pulled"
else
  spinner_stop 1 "Image pull failed"
  log_dim "See ${LOG_FILE} for details"
  tail -20 "${LOG_FILE}" >&2
  exit 1
fi

# ── Start services ────────────────────────────────────────────────────────────
spinner_start "Starting services..."
if ${_compose} up -d >>"${LOG_FILE}" 2>&1; then
  spinner_stop 0 "Services started"
else
  spinner_stop 1 "Failed to start services"
  log_dim "See ${LOG_FILE} for details"
  tail -20 "${LOG_FILE}" >&2
  exit 1
fi

# ── Wait for API health ───────────────────────────────────────────────────────
printf "\n"
printf "  ${BOLD}Waiting for API health check${RESET}\n\n"
printf "  "

_healthy=0
for i in $(seq 1 40); do
  if ${_compose} exec -T api wget --spider --quiet http://localhost:8080/health >>"${LOG_FILE}" 2>&1; then
    _healthy=1
    break
  fi
  printf "${CYAN}.${RESET}"
  sleep 3
done
printf "\n\n"

if [[ "${_healthy}" -eq 1 ]]; then
  log_ok "API is healthy"
else
  log_warn "API health check timed out after 2 minutes."
  log_dim "Services may still be starting. Check with:"
  log_dim "  sudo ${INSTALL_DIR}/installer/doctor.sh ${INSTALL_DIR}"
fi

# ── Service status ────────────────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Service Status"

${_compose} ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null \
  | while IFS= read -r line; do printf "  %s\n" "${line}"; done

printf "\n"
log_dim "Full deploy log: ${LOG_FILE}"
