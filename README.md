# Sofon

A self hosted uptime monitoring service built with Go. Sofon continuously checks your endpoints on a configurable schedule, tracks response status and latency, and sends email alerts when failures exceed a threshold so you know your services are down before your users do.

## Local Development

Run local stack (builds images from source):

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

## Production Self-Host (Option A)

Production stack files:
- `deploy/docker-compose.prod.yml`
- `deploy/config.production.yaml.tmpl`
- `deploy/Caddyfile.domain.tmpl`
- `deploy/Caddyfile.nodomain.tmpl`
- `installer/install.sh`
- `installer/setup.sh`
- `installer/deploy.sh`
- `installer/doctor.sh`

### 1) Publish images

Build and push immutable image tags:

```bash
docker build -t ghcr.io/<org>/sofon-api:v1.0.0 -f Dockerfile .
docker push ghcr.io/<org>/sofon-api:v1.0.0

docker build -t ghcr.io/<org>/sofon-web:v1.0.0 -f web/Dockerfile web
docker push ghcr.io/<org>/sofon-web:v1.0.0
```

### 2) Host installer script

Host `installer/install.sh` at a public URL (for example your CDN or GitHub raw).

The installer downloads:
- `installer/setup.sh`
- `installer/deploy.sh`
- `installer/doctor.sh`
- all required files from `deploy/`

### 3) Install on EC2

On a fresh Ubuntu/Debian EC2 instance:

```bash
curl -fsSL https://<your-host>/install.sh | sudo bash
```

Installer flow:
- installs Docker (if missing)
- asks for domain, image tags, DB password, alert settings
- writes `/opt/sofon/.env`, `/opt/sofon/config/config.yaml`, `/opt/sofon/Caddyfile`
- pulls images and starts stack

### 4) Operate and troubleshoot

```bash
sudo /opt/sofon/installer/doctor.sh /opt/sofon
sudo /opt/sofon/installer/deploy.sh /opt/sofon
```

## GitHub Automation

This repo includes:
- `.github/workflows/docker-publish.yml`: builds on PRs and pushes `sofon-api` + `sofon-web` to GHCR on `main` and `v*` tags.
- `.github/workflows/release-installer.yml`: creates a GitHub Release on `v*` tags and uploads installer artifacts.

One-time repository settings:
1. `Settings -> Actions -> General -> Workflow permissions -> Read and write permissions`
2. `Settings -> Actions -> General -> Allow GitHub Actions to create and approve pull requests` (optional, safe to enable)
3. Ensure package visibility for `sofon-api` and `sofon-web` is `Public` in GitHub Packages.
