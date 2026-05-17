# Sofon

Self-hosted uptime monitoring. Deploy on your own server in one command — no SaaS fees, no data leaving your network.

```bash
curl -fsSL https://raw.githubusercontent.com/Alkush-Pipania/sofon/main/installer/install.sh | sudo bash
```

---

## What it does

- Polls your HTTP endpoints on a configurable interval
- Creates an incident after 3 consecutive failures
- Sends alerts via **Resend Email** or **Zenduty**
- Auto-resolves incidents and sends recovery notifications when the monitor comes back up
- Clean web dashboard to manage monitors, plugins, and incident history

---

## Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| API      | Go, Chi, sqlc, pgx                |
| Frontend | Next.js 15, Tailwind CSS          |
| Database | PostgreSQL 17                     |
| Cache    | Redis 7                           |
| Proxy    | Caddy (automatic HTTPS)           |
| Runtime  | Docker + Docker Compose           |

---

## Self-host

### Install (fresh server)

Works on Ubuntu, Debian, Amazon Linux, RHEL. Docker is installed automatically if missing.

```bash
curl -fsSL https://raw.githubusercontent.com/Alkush-Pipania/sofon/main/installer/install.sh | sudo bash
```

The installer will ask for:
- Install directory (default `/opt/sofon`)
- Domain name (optional — enables automatic HTTPS via Caddy)
- Database credentials (auto-generated if left blank)
- App public URL

> **AWS EC2 / cloud VPS:** open ports **80** and **443** in your security group / firewall before accessing the URL.

### Upgrade

```bash
sudo /opt/sofon/installer/update.sh --version latest
```

### Uninstall

```bash
sudo /opt/sofon/installer/uninstall.sh
```

### Diagnose

```bash
sudo /opt/sofon/installer/doctor.sh /opt/sofon
```

---

## Local development

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

The dev stack builds images from source and mounts config files locally.

---

## Plugins

Configure plugins in the web UI under **Settings → Plugins**.

| Plugin        | What it does                                              |
|---------------|-----------------------------------------------------------|
| Resend Email  | Sends alert + recovery emails via the Resend API          |
| Zenduty       | Creates and auto-resolves incidents via Generic Integration webhook |

Each monitor can be configured to notify specific plugins — not every alert needs to page your whole team.

---

## CI / CD

| Workflow                    | Trigger           | What it does                                      |
|-----------------------------|-------------------|---------------------------------------------------|
| `docker-publish.yml`        | push to `main`, `v*` tags | Builds and pushes `sofon-api` + `sofon-web` to GHCR |
| `release-installer.yml`     | `v*` tags         | Creates a GitHub Release with installer artifacts |

**One-time repo setup:**
1. Settings → Actions → General → **Read and write permissions**
2. Ensure `sofon-api` and `sofon-web` packages are set to **Public** in GitHub Packages

---

## License

MIT
