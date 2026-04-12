#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

prompt_default() {
  local question="$1"
  local default_val="$2"
  local answer
  read -r -p "${question} [${default_val}]: " answer
  if [[ -z "${answer}" ]]; then
    answer="${default_val}"
  fi
  printf '%s' "${answer}"
}

prompt_secret() {
  local question="$1"
  local answer
  read -r -s -p "${question}: " answer
  echo
  printf '%s' "${answer}"
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

escape_sed() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

DEFAULT_IMAGE_TAG="${SOFON_RELEASE_VERSION:-v1.0.0}"

INSTALL_DIR="$(prompt_default "Install directory" "/opt/sofon")"
SOFON_API_IMAGE="$(prompt_default "API image" "ghcr.io/alkush-pipania/sofon-api:${DEFAULT_IMAGE_TAG}")"
SOFON_WEB_IMAGE="$(prompt_default "Web image" "ghcr.io/alkush-pipania/sofon-web:${DEFAULT_IMAGE_TAG}")"
POSTGRES_USER="$(prompt_default "Postgres user" "sofon")"
POSTGRES_DB="$(prompt_default "Postgres database" "sofon")"
POSTGRES_PASSWORD="$(prompt_secret "Postgres password")"
if [[ -z "${POSTGRES_PASSWORD}" ]]; then
  POSTGRES_PASSWORD="$(random_secret)"
  echo "Generated random Postgres password."
fi

SOFON_OWNER_EMAIL="$(prompt_default "Default alert sender email" "alerts@example.com")"
SOFON_AUTH_SECRET="$(prompt_secret "Auth JWT secret (leave empty to auto-generate)")"
if [[ -z "${SOFON_AUTH_SECRET}" ]]; then
  SOFON_AUTH_SECRET="$(random_secret)"
  echo "Generated random auth secret."
fi

ENABLE_RESEND="$(prompt_default "Enable outgoing alert emails? (y/n)" "n")"
SOFON_ALERT_KILL_SWITCH="true"
SOFON_RESEND_API_KEY=""
if [[ "${ENABLE_RESEND}" =~ ^[Yy]$ ]]; then
  SOFON_ALERT_KILL_SWITCH="false"
  SOFON_RESEND_API_KEY="$(prompt_secret "Resend API key")"
fi

USE_DOMAIN="$(prompt_default "Use domain + automatic HTTPS via Caddy? (y/n)" "n")"
SOFON_DOMAIN=""
SOFON_HTTP_PORT="80"
SOFON_HTTPS_PORT="443"
CADDY_TEMPLATE="${ROOT_DIR}/deploy/Caddyfile.nodomain.tmpl"
if [[ "${USE_DOMAIN}" =~ ^[Yy]$ ]]; then
  SOFON_DOMAIN="$(prompt_default "Domain (example: uptime.example.com)" "")"
  if [[ -z "${SOFON_DOMAIN}" ]]; then
    echo "Domain is required when HTTPS mode is enabled." >&2
    exit 1
  fi
  CADDY_TEMPLATE="${ROOT_DIR}/deploy/Caddyfile.domain.tmpl"
else
  SOFON_HTTP_PORT="$(prompt_default "HTTP port" "80")"
  SOFON_HTTPS_PORT="$(prompt_default "HTTPS port" "443")"
fi

mkdir -p "${INSTALL_DIR}/deploy" "${INSTALL_DIR}/config" "${INSTALL_DIR}/installer"
cp "${ROOT_DIR}/deploy/docker-compose.prod.yml" "${INSTALL_DIR}/deploy/docker-compose.prod.yml"
cp "${SCRIPT_DIR}/deploy.sh" "${INSTALL_DIR}/installer/deploy.sh"
cp "${SCRIPT_DIR}/doctor.sh" "${INSTALL_DIR}/installer/doctor.sh"
chmod +x "${INSTALL_DIR}/installer/deploy.sh" "${INSTALL_DIR}/installer/doctor.sh"

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
EOF

cfg_tpl="${ROOT_DIR}/deploy/config.production.yaml.tmpl"
cfg_out="${INSTALL_DIR}/config/config.yaml"
sed -e "s/__SOFON_AUTH_SECRET__/$(escape_sed "${SOFON_AUTH_SECRET}")/g" \
    -e "s/__SOFON_OWNER_EMAIL__/$(escape_sed "${SOFON_OWNER_EMAIL}")/g" \
    -e "s/__SOFON_RESEND_API_KEY__/$(escape_sed "${SOFON_RESEND_API_KEY}")/g" \
    -e "s/__SOFON_ALERT_KILL_SWITCH__/$(escape_sed "${SOFON_ALERT_KILL_SWITCH}")/g" \
    -e "s/__POSTGRES_USER__/$(escape_sed "${POSTGRES_USER}")/g" \
    -e "s/__POSTGRES_PASSWORD__/$(escape_sed "${POSTGRES_PASSWORD}")/g" \
    -e "s/__POSTGRES_DB__/$(escape_sed "${POSTGRES_DB}")/g" \
    "${cfg_tpl}" > "${cfg_out}"

if [[ "${USE_DOMAIN}" =~ ^[Yy]$ ]]; then
  sed -e "s/__DOMAIN__/$(escape_sed "${SOFON_DOMAIN}")/g" "${CADDY_TEMPLATE}" > "${INSTALL_DIR}/Caddyfile"
else
  cp "${CADDY_TEMPLATE}" "${INSTALL_DIR}/Caddyfile"
fi

"${INSTALL_DIR}/installer/deploy.sh" "${INSTALL_DIR}"

echo
echo "Sofon installation complete."
echo "Install directory: ${INSTALL_DIR}"
if [[ -n "${SOFON_DOMAIN}" ]]; then
  echo "Open: https://${SOFON_DOMAIN}"
else
  echo "Open: http://<server-ip>:${SOFON_HTTP_PORT}"
fi
echo "Run diagnostics: sudo ${INSTALL_DIR}/installer/doctor.sh ${INSTALL_DIR}"
