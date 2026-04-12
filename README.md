# Sofon

A self hosted uptime monitoring service built with Go. Sofon continuously checks your endpoints on a configurable schedule, tracks response status and latency, and sends email alerts when failures exceed a threshold so you know your services are down before your users do.

## Docker Setup

Docker artifacts are organized as:
- `Dockerfile` for the Go API image build.
- `web/Dockerfile` for the Next.js web image build.
- `deploy/docker-compose.yml` for full local/self-host orchestration.
- `config/config.docker.yaml` for container runtime config copied into the API image.

Images/services used:
- `sofon-api:latest` (built from this repo)
- `sofon-web:latest` (built from `web/`)
- `postgres:17-alpine`
- `redis:7-alpine`

Network and volumes:
- Docker network: `sofon-net`
- Volumes: `sofon-postgres-data`, `sofon-redis-data`

Run:

```bash
NEXT_PUBLIC_API_URL=http://<EC2_PUBLIC_IP_OR_DOMAIN>:8080 \
docker compose -f deploy/docker-compose.yml up -d --build
```

Or use Make:

```bash
make up
```

If Docker build fails with `ENOSPC` / `no space left on device`, clean Docker Desktop cache/layers:

```bash
make soft-clean
# if still full:
make clean
```
