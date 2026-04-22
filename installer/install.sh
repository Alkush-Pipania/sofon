#!/usr/bin/env bash
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RESET='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'

log_step()  { printf "\n${BOLD}${CYAN}  ➜${RESET}  ${BOLD}%s${RESET}\n" "$*"; }
log_ok()    { printf "  ${GREEN}✓${RESET}  %s\n" "$*"; }
log_warn()  { printf "  ${YELLOW}!${RESET}  %s\n" "$*"; }
log_error() { printf "  ${RED}✗  %s${RESET}\n" "$*" >&2; }
log_dim()   { printf "  ${DIM}  %s${RESET}\n" "$*"; }

# ── Spinner ───────────────────────────────────────────────────────────────────
_SPIN_PID=""
_SPIN_MSG=""
_FRAMES=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

spinner_start() {
  _SPIN_MSG="$1"
  ( i=0
    while true; do
      printf "\r  ${CYAN}%s${RESET}  %s   " "${_FRAMES[$i]}" "${_SPIN_MSG}"
      i=$(( (i+1) % 10 ))
      sleep 0.1
    done
  ) 2>/dev/null &
  _SPIN_PID=$!
}

spinner_stop() {   # $1=0 success | $2=label
  [[ -n "${_SPIN_PID}" ]] && { kill "${_SPIN_PID}" 2>/dev/null; wait "${_SPIN_PID}" 2>/dev/null || true; _SPIN_PID=""; }
  printf "\r%-72s\r" " "
  [[ "${1:-0}" -eq 0 ]] && log_ok "$2" || log_error "$2"
}

run_step() {   # run_step "Label" cmd [args...]
  local label="$1"; shift
  local log="/tmp/sofon-step-$$.log"
  spinner_start "${label}"
  if "$@" >"${log}" 2>&1; then
    spinner_stop 0 "${label}"
    rm -f "${log}"
  else
    spinner_stop 1 "${label} — failed"
    printf "\n${DIM}--- log ---${RESET}\n"
    tail -20 "${log}" >&2
    printf "${DIM}-----------${RESET}\n\n"
    rm -f "${log}"
    exit 1
  fi
}

# ── Cleanup on exit ───────────────────────────────────────────────────────────
_cleanup() {
  [[ -n "${_SPIN_PID}" ]] && kill "${_SPIN_PID}" 2>/dev/null || true
  rm -rf "${WORK_DIR:-}"
}
trap _cleanup EXIT

# ── Args ──────────────────────────────────────────────────────────────────────
SOFON_INSTALL_REF="${SOFON_INSTALL_REF:-main}"
SOFON_RELEASE_VERSION="${SOFON_RELEASE_VERSION:-}"
WORK_DIR="$(mktemp -d /tmp/sofon-installer.XXXXXX)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      [[ $# -lt 2 ]] && { log_error "missing value for --version"; exit 1; }
      SOFON_RELEASE_VERSION="$2"; SOFON_INSTALL_REF="$2"; shift 2 ;;
    *) log_error "unknown argument: $1"; exit 1 ;;
  esac
done

SOFON_REPO_RAW="${SOFON_REPO_RAW:-https://raw.githubusercontent.com/alkush-pipania/sofon/${SOFON_INSTALL_REF}}"

# ── Banner ────────────────────────────────────────────────────────────────────
printf "\n"
printf "  ${BOLD}${CYAN}███████╗ ██████╗ ███████╗ ██████╗ ███╗   ██╗${RESET}\n"
printf "  ${BOLD}${CYAN}██╔════╝██╔═══██╗██╔════╝██╔═══██╗████╗  ██║${RESET}\n"
printf "  ${BOLD}${CYAN}███████╗██║   ██║█████╗  ██║   ██║██╔██╗ ██║${RESET}\n"
printf "  ${BOLD}${CYAN}╚════██║██║   ██║██╔══╝  ██║   ██║██║╚██╗██║${RESET}\n"
printf "  ${BOLD}${CYAN}███████║╚██████╔╝██║     ╚██████╔╝██║ ╚████║${RESET}\n"
printf "  ${BOLD}${CYAN}╚══════╝ ╚═════╝ ╚═╝      ╚═════╝ ╚═╝  ╚═══╝${RESET}\n"
printf "\n"
printf "  ${DIM}Self-hosted uptime monitoring — installer${RESET}"
[[ -n "${SOFON_RELEASE_VERSION}" ]] && printf "  ${BOLD}%s${RESET}" "${SOFON_RELEASE_VERSION}"
printf "\n\n"
printf "  ${DIM}%s${RESET}\n" "──────────────────────────────────────────────"
printf "\n"

# ── Root check ────────────────────────────────────────────────────────────────
if [[ "${EUID}" -ne 0 ]]; then
  log_warn "Re-running with sudo..."
  exec sudo -E bash "$0" "$@"
fi

need_cmd() { command -v "$1" >/dev/null 2>&1; }

# ── Compose plugin helper ─────────────────────────────────────────────────────
_install_compose_plugin() {
  local arch; arch="$(uname -m)"
  local dest="/usr/local/lib/docker/cli-plugins/docker-compose"
  mkdir -p "$(dirname "${dest}")"
  curl -fsSL \
    "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${arch}" \
    -o "${dest}"
  chmod +x "${dest}"
}

# ── Docker install ────────────────────────────────────────────────────────────
log_step "Checking Docker"

if need_cmd docker && docker compose version >/dev/null 2>&1; then
  log_ok "Docker $(docker --version | grep -oP '[\d.]+' | head -1) already installed"
else
  if [[ -f /etc/debian_version ]]; then
    log_dim "Detected Debian / Ubuntu"
    run_step "Installing Docker (apt)" bash -c '
      apt-get update -y
      apt-get install -y ca-certificates curl gnupg
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
      chmod a+r /etc/apt/keyrings/docker.asc
      . /etc/os-release
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
        > /etc/apt/sources.list.d/docker.list
      apt-get update -y
      apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      systemctl enable --now docker
    '
  elif need_cmd dnf; then
    log_dim "Detected Amazon Linux 2023 / RHEL / Fedora (dnf)"
    run_step "Installing Docker (dnf)" bash -c 'dnf install -y docker && systemctl enable --now docker'
    run_step "Installing Docker Compose plugin" _install_compose_plugin
  elif need_cmd yum; then
    log_dim "Detected Amazon Linux 2 / CentOS (yum)"
    run_step "Installing Docker (yum)" bash -c 'yum install -y docker && systemctl enable --now docker'
    run_step "Installing Docker Compose plugin" _install_compose_plugin
  elif need_cmd curl; then
    log_warn "Unknown OS — falling back to get.docker.com"
    run_step "Installing Docker (get.docker.com)" bash -c 'curl -fsSL https://get.docker.com | sh && systemctl enable --now docker'
    docker compose version >/dev/null 2>&1 || run_step "Installing Docker Compose plugin" _install_compose_plugin
  else
    log_error "Cannot install Docker automatically on this OS."
    log_error "Install Docker Engine + Compose plugin manually, then re-run."
    exit 1
  fi
  log_ok "Docker $(docker --version | grep -oP '[\d.]+' | head -1) ready"
fi

# ── Download installer files ──────────────────────────────────────────────────
log_step "Downloading installer files"

_download() {
  local rel="$1"
  local out="${WORK_DIR}/${rel}"
  mkdir -p "$(dirname "${out}")"
  curl -fsSL "${SOFON_REPO_RAW}/${rel}" -o "${out}"
}

run_step "Fetching files from GitHub" bash -c "
  set -euo pipefail
  _dl() { mkdir -p \"\$(dirname \"${WORK_DIR}/\$1\")\"; curl -fsSL \"${SOFON_REPO_RAW}/\$1\" -o \"${WORK_DIR}/\$1\"; }
  _dl installer/setup.sh
  _dl installer/deploy.sh
  _dl installer/doctor.sh
  _dl installer/update.sh
  _dl deploy/docker-compose.prod.yml
  _dl deploy/config.production.yaml.tmpl
  _dl deploy/Caddyfile.domain.tmpl
  _dl deploy/Caddyfile.nodomain.tmpl
  _dl deploy/env.production.example
"

chmod +x "${WORK_DIR}/installer/setup.sh" \
         "${WORK_DIR}/installer/deploy.sh" \
         "${WORK_DIR}/installer/doctor.sh"

log_ok "Installer files ready"

# ── Hand off to setup wizard ──────────────────────────────────────────────────
printf "\n"
printf "  ${DIM}%s${RESET}\n\n" "──────────────────────────────────────────────"

if [[ -n "${SOFON_RELEASE_VERSION}" ]]; then
  SOFON_RELEASE_VERSION="${SOFON_RELEASE_VERSION}" "${WORK_DIR}/installer/setup.sh"
else
  "${WORK_DIR}/installer/setup.sh"
fi
