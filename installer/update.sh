#!/usr/bin/env bash
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RESET='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'

log_header() { printf "\n  ${BOLD}%s${RESET}\n\n" "$*"; }
log_ok()     { printf "  ${GREEN}✓${RESET}  %s\n" "$*"; }
log_warn()   { printf "  ${YELLOW}!${RESET}  %s\n" "$*"; }
log_error()  { printf "  ${RED}✗  %s${RESET}\n" "$*" >&2; }
log_dim()    { printf "  ${DIM}  %s${RESET}\n" "$*"; }
log_field()  { printf "  ${DIM}%-30s${RESET}  ${CYAN}%s${RESET}\n" "$1" "$2"; }

# ── Args ──────────────────────────────────────────────────────────────────────
NEW_VERSION=""
INSTALL_DIR="/opt/sofon"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) [[ $# -lt 2 ]] && { log_error "missing value for --version"; exit 1; }
               NEW_VERSION="$2"; shift 2 ;;
    --dir)     [[ $# -lt 2 ]] && { log_error "missing value for --dir"; exit 1; }
               INSTALL_DIR="$2"; shift 2 ;;
    *) log_error "unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "${NEW_VERSION}" ]]; then
  printf "  Usage: update.sh --version <version> [--dir <install-dir>]\n\n"
  printf "  Example:\n"
  printf "    sudo /opt/sofon/installer/update.sh --version v0.1.8\n\n"
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

ENV_FILE="${INSTALL_DIR}/.env"
COMPOSE_FILE="${INSTALL_DIR}/deploy/docker-compose.prod.yml"
REPO_RAW="https://raw.githubusercontent.com/Alkush-Pipania/sofon/${NEW_VERSION}"

# ── Pre-flight ────────────────────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Sofon Update → ${NEW_VERSION}"

if [[ ! -f "${ENV_FILE}" ]]; then
  log_error "No installation found at ${INSTALL_DIR}"
  log_dim "Run the installer first: curl -fsSL https://raw.githubusercontent.com/Alkush-Pipania/sofon/main/installer/install.sh | sudo bash"
  exit 1
fi

# Read current versions for display
CURRENT_API_IMAGE="$(grep '^SOFON_API_IMAGE=' "${ENV_FILE}" | cut -d= -f2-)"
CURRENT_WEB_IMAGE="$(grep '^SOFON_WEB_IMAGE=' "${ENV_FILE}" | cut -d= -f2-)"
CURRENT_VERSION="$(printf '%s' "${CURRENT_API_IMAGE}" | grep -oP '(?<=:).*$' || echo "unknown")"

log_field "Install dir"    "${INSTALL_DIR}"
log_field "Current version" "${CURRENT_VERSION}"
log_field "Target version"  "${NEW_VERSION}"
printf "\n"

if [[ "${CURRENT_VERSION}" == "${NEW_VERSION}" ]]; then
  log_warn "Already on ${NEW_VERSION}. Use a different --version to upgrade."
  exit 0
fi

# ── Backup .env ───────────────────────────────────────────────────────────────
BACKUP="${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "${ENV_FILE}" "${BACKUP}"
log_ok "Backed up .env → ${BACKUP}"

# ── Update image tags in .env ─────────────────────────────────────────────────
sed -i "s|^SOFON_API_IMAGE=.*|SOFON_API_IMAGE=ghcr.io/alkush-pipania/sofon-api:${NEW_VERSION}|" "${ENV_FILE}"
sed -i "s|^SOFON_WEB_IMAGE=.*|SOFON_WEB_IMAGE=ghcr.io/alkush-pipania/sofon-web:${NEW_VERSION}|" "${ENV_FILE}"
log_ok "Updated image tags in .env"

# ── Download updated deploy files ─────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Downloading updated files"

_dl() {
  local src="${REPO_RAW}/$1" dst="${INSTALL_DIR}/$2"
  mkdir -p "$(dirname "${dst}")"
  if curl -fsSL "${src}" -o "${dst}"; then
    log_ok "$2"
  else
    log_error "Failed to download $1 — rolling back .env"
    cp "${BACKUP}" "${ENV_FILE}"
    exit 1
  fi
}

_dl "deploy/docker-compose.prod.yml"    "deploy/docker-compose.prod.yml"
_dl "installer/deploy.sh"               "installer/deploy.sh"
_dl "installer/doctor.sh"               "installer/doctor.sh"
_dl "installer/update.sh"               "installer/update.sh"
chmod +x "${INSTALL_DIR}/installer/deploy.sh" \
         "${INSTALL_DIR}/installer/doctor.sh" \
         "${INSTALL_DIR}/installer/update.sh"

# ── Deploy ────────────────────────────────────────────────────────────────────
printf "\n"
"${INSTALL_DIR}/installer/deploy.sh" "${INSTALL_DIR}"

# ── Done ──────────────────────────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
printf "\n"
printf "  ${BOLD}${GREEN}✓  Updated to ${NEW_VERSION}${RESET}\n\n"
log_dim "Your data, secrets, and config were not changed."
log_dim "Diagnostics: sudo ${INSTALL_DIR}/installer/doctor.sh ${INSTALL_DIR}"
printf "\n"
