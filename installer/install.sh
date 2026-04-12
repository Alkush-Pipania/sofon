#!/usr/bin/env bash
set -euo pipefail

SOFON_INSTALL_REF="${SOFON_INSTALL_REF:-main}"
WORK_DIR="$(mktemp -d /tmp/sofon-installer.XXXXXX)"
SOFON_RELEASE_VERSION="${SOFON_RELEASE_VERSION:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      if [[ $# -lt 2 ]]; then
        echo "missing value for --version" >&2
        exit 1
      fi
      SOFON_RELEASE_VERSION="$2"
      SOFON_INSTALL_REF="$2"
      shift 2
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

SOFON_REPO_RAW="${SOFON_REPO_RAW:-https://raw.githubusercontent.com/alkush-pipania/sofon/${SOFON_INSTALL_REF}}"

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

install_docker() {
  if need_cmd docker && docker compose version >/dev/null 2>&1; then
    return
  fi

  if [[ -f /etc/debian_version ]]; then
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    . /etc/os-release
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    return
  fi

  echo "Unsupported OS for automatic Docker install. Please install Docker manually." >&2
  exit 1
}

download_file() {
  local rel_path="$1"
  local out_path="${WORK_DIR}/${rel_path}"
  mkdir -p "$(dirname "${out_path}")"
  curl -fsSL "${SOFON_REPO_RAW}/${rel_path}" -o "${out_path}"
}

install_docker

download_file "installer/setup.sh"
download_file "installer/deploy.sh"
download_file "installer/doctor.sh"
download_file "deploy/docker-compose.prod.yml"
download_file "deploy/config.production.yaml.tmpl"
download_file "deploy/Caddyfile.domain.tmpl"
download_file "deploy/Caddyfile.nodomain.tmpl"
download_file "deploy/env.production.example"

chmod +x "${WORK_DIR}/installer/setup.sh" "${WORK_DIR}/installer/deploy.sh" "${WORK_DIR}/installer/doctor.sh"

if [[ -n "${SOFON_RELEASE_VERSION}" ]]; then
  SOFON_RELEASE_VERSION="${SOFON_RELEASE_VERSION}" "${WORK_DIR}/installer/setup.sh"
else
  "${WORK_DIR}/installer/setup.sh"
fi
