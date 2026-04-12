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

echo "=== Docker Compose Status ==="
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps

echo
echo "=== API Health (inside container) ==="
if docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T api wget --spider --quiet http://localhost:8080/health; then
  echo "API health check passed"
else
  echo "API health check failed"
fi

echo
echo "=== Recent API Logs ==="
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs --tail=80 api

echo
echo "=== Recent Caddy Logs ==="
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs --tail=80 caddy
