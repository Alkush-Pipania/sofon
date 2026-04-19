#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

# ── Colour helpers ────────────────────────────────────────────────────────────
RESET='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'

log_header() { printf "\n  ${BOLD}%s${RESET}\n" "$*"; }
log_ok()     { printf "  ${GREEN}✓${RESET}  %s\n" "$*"; }
log_warn()   { printf "  ${YELLOW}!${RESET}  %s\n" "$*"; }
log_error()  { printf "  ${RED}✗  %s${RESET}\n" "$*" >&2; }
log_dim()    { printf "  ${DIM}  %s${RESET}\n" "$*"; }
log_field()  { printf "  ${DIM}%-30s${RESET}  ${CYAN}%s${RESET}\n" "$1" "$2"; }

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

# Verify /dev/tty is accessible — required for interactive prompts
if [[ ! -e /dev/tty ]]; then
  printf "  /dev/tty not available. Cannot run interactive prompts.\n" >&2
  exit 1
fi

# ── Prompt helpers ────────────────────────────────────────────────────────────
prompt_default() {
  local question="$1" default_val="$2" answer
  # Print prompt to /dev/tty so it shows even inside $() subshells
  printf "  ${CYAN}?${RESET}  ${BOLD}%s${RESET} ${DIM}[%s]${RESET}: " "${question}" "${default_val}" >/dev/tty
  read -r answer </dev/tty
  printf '%s' "${answer:-${default_val}}"
}

prompt_secret() {
  local question="$1" answer
  printf "  ${CYAN}?${RESET}  ${BOLD}%s${RESET}: " "${question}" >/dev/tty
  read -r -s answer </dev/tty
  printf "\n" >/dev/tty
  printf '%s' "${answer}"
}

prompt_yn() {   # returns 0 for yes, 1 for no
  local question="$1" default="${2:-n}" answer
  local hint; [[ "${default}" == "y" ]] && hint="Y/n" || hint="y/N"
  printf "  ${CYAN}?${RESET}  ${BOLD}%s${RESET} ${DIM}[%s]${RESET}: " "${question}" "${hint}" >/dev/tty
  read -r answer </dev/tty
  answer="${answer:-${default}}"
  [[ "${answer}" =~ ^[Yy]$ ]]
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32
  else head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

escape_sed() { printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'; }

# ── Section: Installation target ─────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Installation"
printf "\n"

DEFAULT_IMAGE_TAG="${SOFON_RELEASE_VERSION:-v0.1.2}"

INSTALL_DIR="$(prompt_default "Install directory" "/opt/sofon")"
SOFON_API_IMAGE="$(prompt_default "API image" "ghcr.io/alkush-pipania/sofon-api:${DEFAULT_IMAGE_TAG}")"
SOFON_WEB_IMAGE="$(prompt_default "Web image" "ghcr.io/alkush-pipania/sofon-web:${DEFAULT_IMAGE_TAG}")"

# ── Section: Database ─────────────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Database"
printf "\n"

POSTGRES_USER="$(prompt_default "Postgres user" "sofon")"
POSTGRES_DB="$(prompt_default "Postgres database" "sofon")"
POSTGRES_PASSWORD="$(prompt_secret "Postgres password (leave empty to auto-generate)")"
if [[ -z "${POSTGRES_PASSWORD}" ]]; then
  POSTGRES_PASSWORD="$(random_secret)"
  log_ok "Generated random Postgres password"
fi

# ── Section: Security ─────────────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Security"
printf "\n"

SOFON_AUTH_SECRET="$(prompt_secret "JWT auth secret (leave empty to auto-generate)")"
if [[ -z "${SOFON_AUTH_SECRET}" ]]; then
  SOFON_AUTH_SECRET="$(random_secret)"
  log_ok "Generated random JWT secret"
fi

# ── Section: Alerts ───────────────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Alert Emails"
printf "\n"

SOFON_OWNER_EMAIL="$(prompt_default "Alert sender email" "alerts@example.com")"
SOFON_ALERT_KILL_SWITCH="true"
SOFON_RESEND_API_KEY=""

if prompt_yn "Enable outgoing alert emails via Resend?"; then
  SOFON_ALERT_KILL_SWITCH="false"
  SOFON_RESEND_API_KEY="$(prompt_secret "Resend API key")"
else
  log_dim "Alert emails disabled — you can enable later by editing ${INSTALL_DIR}/config/config.yaml"
fi

# ── Section: Network ──────────────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Network"
printf "\n"

SOFON_DOMAIN=""
SOFON_HTTP_PORT="80"
SOFON_HTTPS_PORT="443"
SOFON_APP_URL=""
CADDY_TEMPLATE="${ROOT_DIR}/deploy/Caddyfile.nodomain.tmpl"

if prompt_yn "Use a domain with automatic HTTPS (via Caddy)?"; then
  SOFON_DOMAIN="$(prompt_default "Domain" "")"
  if [[ -z "${SOFON_DOMAIN}" ]]; then
    log_error "A domain name is required for HTTPS mode."
    exit 1
  fi
  SOFON_APP_URL="https://${SOFON_DOMAIN}"
  CADDY_TEMPLATE="${ROOT_DIR}/deploy/Caddyfile.domain.tmpl"
  log_ok "Caddy will obtain a TLS certificate for ${SOFON_DOMAIN}"
else
  SOFON_HTTP_PORT="$(prompt_default "HTTP port" "80")"
  SOFON_HTTPS_PORT="$(prompt_default "HTTPS port" "443")"

  # Auto-detect public IP for a sensible default
  printf "  ${DIM}  Detecting public IP...${RESET}\n"
  _detected_ip="$(curl -sf --max-time 5 https://ifconfig.me 2>/dev/null \
    || curl -sf --max-time 5 https://api.ipify.org 2>/dev/null \
    || echo "")"
  printf "\033[1A\033[2K"  # move up one line and erase it

  if [[ -n "${_detected_ip}" && "${SOFON_HTTP_PORT}" == "80" ]]; then
    _default_url="http://${_detected_ip}"
  elif [[ -n "${_detected_ip}" ]]; then
    _default_url="http://${_detected_ip}:${SOFON_HTTP_PORT}"
  else
    _default_url="http://localhost:${SOFON_HTTP_PORT}"
  fi

  SOFON_APP_URL="$(prompt_default "App public URL (used in invite links)" "${_default_url}")"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Summary"
printf "\n"
log_field "Install directory"  "${INSTALL_DIR}"
log_field "API image"          "${SOFON_API_IMAGE}"
log_field "Web image"          "${SOFON_WEB_IMAGE}"
log_field "Database"           "${POSTGRES_USER}@postgres/${POSTGRES_DB}"
log_field "App URL"            "${SOFON_APP_URL}"
if [[ -n "${SOFON_DOMAIN}" ]]; then
  log_field "TLS domain"       "${SOFON_DOMAIN}"
else
  log_field "HTTP port"        "${SOFON_HTTP_PORT}"
fi
log_field "Alert emails"       "$( [[ "${SOFON_ALERT_KILL_SWITCH}" == "false" ]] && echo "enabled" || echo "disabled" )"
printf "\n"

if ! prompt_yn "Everything look correct? Proceed with installation?"; then
  log_warn "Aborted. Re-run to start over."
  exit 0
fi

# ── Write files ───────────────────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
log_header "Writing configuration"
printf "\n"

mkdir -p "${INSTALL_DIR}/deploy" "${INSTALL_DIR}/config" "${INSTALL_DIR}/installer"
cp "${ROOT_DIR}/deploy/docker-compose.prod.yml" "${INSTALL_DIR}/deploy/docker-compose.prod.yml"
cp "${SCRIPT_DIR}/deploy.sh"  "${INSTALL_DIR}/installer/deploy.sh"
cp "${SCRIPT_DIR}/doctor.sh"  "${INSTALL_DIR}/installer/doctor.sh"
chmod +x "${INSTALL_DIR}/installer/deploy.sh" "${INSTALL_DIR}/installer/doctor.sh"
log_ok "Copied runtime files"

cat > "${INSTALL_DIR}/.env" <<EOF
SOFON_HTTP_PORT=${SOFON_HTTP_PORT}
SOFON_HTTPS_PORT=${SOFON_HTTPS_PORT}
SOFON_API_IMAGE=${SOFON_API_IMAGE}
SOFON_WEB_IMAGE=${SOFON_WEB_IMAGE}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
SOFON_DOMAIN=${SOFON_DOMAIN}
SOFON_OWNER_EMAIL=${SOFON_OWNER_EMAIL}
SOFON_AUTH_SECRET=${SOFON_AUTH_SECRET}
SOFON_RESEND_API_KEY=${SOFON_RESEND_API_KEY}
SOFON_ALERT_KILL_SWITCH=${SOFON_ALERT_KILL_SWITCH}
SOFON_APP_URL=${SOFON_APP_URL}
EOF
log_ok "Written ${INSTALL_DIR}/.env"

sed -e "s/__SOFON_AUTH_SECRET__/$(escape_sed "${SOFON_AUTH_SECRET}")/g" \
    -e "s/__SOFON_OWNER_EMAIL__/$(escape_sed "${SOFON_OWNER_EMAIL}")/g" \
    -e "s/__SOFON_RESEND_API_KEY__/$(escape_sed "${SOFON_RESEND_API_KEY}")/g" \
    -e "s/__SOFON_ALERT_KILL_SWITCH__/$(escape_sed "${SOFON_ALERT_KILL_SWITCH}")/g" \
    -e "s/__POSTGRES_USER__/$(escape_sed "${POSTGRES_USER}")/g" \
    -e "s/__POSTGRES_PASSWORD__/$(escape_sed "${POSTGRES_PASSWORD}")/g" \
    -e "s/__POSTGRES_DB__/$(escape_sed "${POSTGRES_DB}")/g" \
    -e "s/__APP_URL__/$(escape_sed "${SOFON_APP_URL}")/g" \
    "${ROOT_DIR}/deploy/config.production.yaml.tmpl" > "${INSTALL_DIR}/config/config.yaml"
log_ok "Written ${INSTALL_DIR}/config/config.yaml"

if [[ "${USE_DOMAIN:-}" =~ ^[Yy]$ ]] || [[ -n "${SOFON_DOMAIN}" ]]; then
  sed -e "s/__DOMAIN__/$(escape_sed "${SOFON_DOMAIN}")/g" \
    "${CADDY_TEMPLATE}" > "${INSTALL_DIR}/Caddyfile"
else
  cp "${CADDY_TEMPLATE}" "${INSTALL_DIR}/Caddyfile"
fi
log_ok "Written ${INSTALL_DIR}/Caddyfile"

# ── Launch ────────────────────────────────────────────────────────────────────
printf "\n"
"${INSTALL_DIR}/installer/deploy.sh" "${INSTALL_DIR}"

# ── Done ──────────────────────────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
printf "\n"
printf "  ${BOLD}${GREEN}🎉  Sofon is running!${RESET}\n\n"
if [[ -n "${SOFON_DOMAIN}" ]]; then
  printf "  ${BOLD}Open:${RESET}         https://${SOFON_DOMAIN}\n"
else
  printf "  ${BOLD}Open:${RESET}         ${SOFON_APP_URL}\n"
fi
printf "  ${BOLD}Install dir:${RESET}  ${INSTALL_DIR}\n"
printf "  ${BOLD}Diagnostics:${RESET}  sudo ${INSTALL_DIR}/installer/doctor.sh ${INSTALL_DIR}\n"
printf "\n"
