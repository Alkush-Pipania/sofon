#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${1:-/opt/sofon}"
COMPOSE_FILE="${INSTALL_DIR}/deploy/docker-compose.prod.yml"
ENV_FILE="${INSTALL_DIR}/.env"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Missing compose file: ${COMPOSE_FILE}" >&2
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed." >&2
  exit 1
fi

cd "${INSTALL_DIR}"

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d

echo "Waiting for API health endpoint..."
for _ in $(seq 1 40); do
  if docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T api wget --spider --quiet http://localhost:8080/health; then
    echo "API is healthy."
    break
  fi
  sleep 3
done

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
