#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${1:-/opt/sofon}"
COMPOSE_FILE="${INSTALL_DIR}/deploy/docker-compose.prod.yml"
ENV_FILE="${INSTALL_DIR}/.env"

# ── Colour helpers ────────────────────────────────────────────────────────────
RESET='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'

log_header() { printf "\n  ${BOLD}%s${RESET}\n\n" "$*"; }
log_ok()     { printf "  ${GREEN}✓${RESET}  %s\n" "$*"; }
log_warn()   { printf "  ${YELLOW}!${RESET}  %s\n" "$*"; }
log_error()  { printf "  ${RED}✗  %s${RESET}\n" "$*" >&2; }
log_dim()    { printf "  ${DIM}  %s${RESET}\n" "$*"; }

prompt_yn() {
  local question="$1" default="${2:-n}" answer hint
  [[ "${default}" == "y" ]] && hint="Y/n" || hint="y/N"
  printf "  ${CYAN}?${RESET}  ${BOLD}%s${RESET} ${DIM}[%s]${RESET}: " "${question}" "${hint}" >/dev/tty
  read -r answer </dev/tty
  answer="${answer:-${default}}"
  [[ "${answer}" =~ ^[Yy]$ ]]
}

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Sofon Uninstall"

log_warn "This will PERMANENTLY delete all Sofon data including:"
log_dim  "  • All containers (api, web, postgres, redis, caddy, migrate)"
log_dim  "  • All volumes (database, redis, caddy certs)"
log_dim  "  • Install directory: ${INSTALL_DIR}"
printf "\n"

if ! prompt_yn "Are you sure you want to completely remove Sofon?"; then
  log_warn "Aborted. Nothing was changed."
  exit 0
fi

# ── Stop and remove containers + volumes ─────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Removing Sofon"

if [[ -f "${COMPOSE_FILE}" && -f "${ENV_FILE}" ]]; then
  printf "  Stopping and removing containers and volumes...\n\n"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" down -v --remove-orphans 2>/dev/null \
    | while IFS= read -r line; do printf "  ${DIM}%s${RESET}\n" "${line}"; done || true
  log_ok "Containers and volumes removed"
else
  log_warn "Compose file or .env not found — skipping container teardown"
  # Try to remove by known container names as fallback
  for c in sofon-api sofon-web sofon-postgres sofon-redis sofon-caddy sofon-migrate; do
    docker rm -f "${c}" 2>/dev/null && log_ok "Removed container ${c}" || true
  done
  for v in sofon-postgres-data sofon-redis-data sofon-caddy-data sofon-caddy-config; do
    docker volume rm "${v}" 2>/dev/null && log_ok "Removed volume ${v}" || true
  done
fi

# ── Remove install directory ──────────────────────────────────────────────────
if [[ -d "${INSTALL_DIR}" ]]; then
  rm -rf "${INSTALL_DIR}"
  log_ok "Removed ${INSTALL_DIR}"
else
  log_warn "${INSTALL_DIR} not found — already removed?"
fi

# ── Optionally remove Docker images ──────────────────────────────────────────
printf "\n"
if prompt_yn "Also remove Sofon Docker images to free disk space?"; then
  for img in \
    ghcr.io/alkush-pipania/sofon-api \
    ghcr.io/alkush-pipania/sofon-web; do
    if docker images --format '{{.Repository}}' | grep -q "^${img}$"; then
      docker rmi "$(docker images --format '{{.Repository}}:{{.Tag}}' | grep "^${img}:")" 2>/dev/null || true
      log_ok "Removed image ${img}"
    fi
  done
fi

# ── Done ──────────────────────────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
printf "\n"
printf "  ${BOLD}Sofon has been fully removed.${RESET}\n\n"
printf "  ${DIM}To reinstall:${RESET}\n"
printf "  ${DIM}  curl -fsSL https://raw.githubusercontent.com/Alkush-Pipania/sofon/main/installer/install.sh | sudo bash${RESET}\n"
printf "\n"
