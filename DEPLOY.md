# Deploying Домашно on a VPS

Target: a fresh Ubuntu 22.04 / 24.04 VPS, a domain or subdomain, ~10 minutes.
Stack: Node + SQLite + a Caddy reverse proxy (Caddy gets HTTPS certificates automatically).

Throughout, replace:

- `YOUR_DOMAIN` → e.g. `domashno.catweb.top`
- `YOUR_EMAIL` → your email (used for Let's Encrypt notices)

---

## 0. What you need

- A VPS with a public IPv4 (and root/sudo access).
- DNS access for your domain.
- Node **20+** (22 recommended).
- Optional: a Resend API key (for email sign-in) — https://resend.com

---

## 1. Point DNS at the server

In your DNS provider, add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `domashno` (or `@`) | `YOUR_SERVER_IP` | 300 |

For a subdomain like `domashno.catweb.top`, the record name is `domashno`.
Wait a minute and check it resolves:

```bash
dig +short YOUR_DOMAIN
```

---

## 2. Install the basics

```bash
sudo apt update && sudo apt upgrade -y

# Node 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git build-essential python3

# Caddy (reverse proxy + automatic HTTPS)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

node -v   # should print v22.x
```

---

## 3. Put the code on the server

Create a system user and clone into `/opt/domashno`:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin domashno
sudo mkdir -p /opt/domashno
sudo chown domashno:domashno /opt/domashno

# as the domashno user
sudo -u domashno git clone <YOUR_REPO_URL> /opt/domashno
cd /opt/domashno
```

(Or upload the folder with `scp`/`rsync` instead of git.)

---

## 4. Install dependencies and build

```bash
cd /opt/domashno
sudo -u domashno npm ci          # or: npm install
sudo -u domashno npm run build   # builds the web app into web/dist
```

The server automatically serves `web/dist`, so one process serves both the API and the app.

---

## 5. Configure `.env`

```bash
sudo -u domashno cp .env.production.example .env
sudo -u domashno nano .env
```

Set at least:

```ini
NODE_ENV=production
PORT=8787
APP_URL=https://YOUR_DOMAIN
SERVER_URL=https://YOUR_DOMAIN
SESSION_SECRET=...            # generate below
ENABLE_DEV_LOGIN=0
EMAIL_FROM="Домашно <noreply@YOUR_DOMAIN>"
RESEND_API_KEY=re_xxxxxxxx    # if using Resend
GOOGLE_CLIENT_ID=...          # optional
GOOGLE_CLIENT_SECRET=...
```

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomUUID()+require('crypto').randomUUID())"
```

Then verify what the server sees:

```bash
cd /opt/domashno && sudo -u domashno node -e "import('./server/src/env.js').then(e=>console.log(e.APP_URL, e.EMAIL_PROVIDER, e.ENABLE_DEV_LOGIN))"
```

---

## 6. Run it as a service

```bash
sudo cp deploy/domashno.service /etc/systemd/system/domashno.service
sudo systemctl daemon-reload
sudo systemctl enable --now domashno
sudo systemctl status domashno        # should be "active (running)"
curl -s localhost:8787/api/health     # {"ok":true}
```

Logs:

```bash
journalctl -u domashno -f
```

---

## 7. HTTPS with Caddy

```bash
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile        # change the address to YOUR_DOMAIN
sudo systemctl reload caddy
```

Caddy asks Let's Encrypt for a certificate automatically. Open
`https://YOUR_DOMAIN` — you should see the sign-in page with a valid padlock.

> First load needs DNS to be correct and ports 80 + 443 open (`sudo ufw allow 80,443/tcp`).

---

## 8. First sign-in

1. Open `https://YOUR_DOMAIN`.
2. Sign in with **Google**, or with **email** (you'll get a 6-digit code).
3. Create your class → **Edit (timetable)** → **Choose PDF** and upload the Shkolo PDF
   → review → **Save**. Then invite classmates with the invite code.

### Update the OAuth redirect URL (important)
In the Google Cloud console → your OAuth client → **Authorized redirect URIs**, add:

```
https://YOUR_DOMAIN/api/auth/google/callback
```

(Keep the `http://localhost:8787/...` one for local dev.)

### Verify your email domain (for email sign-in)
In Resend → **Domains** → add `YOUR_DOMAIN`, then add the DNS records it shows.
Until the domain is verified, sends fail and the UI reports `email_failed`.

---

## 9. Updating later

```bash
cd /opt/domashno
sudo -u domashno git pull
sudo -u domashno npm ci
sudo -u domashno npm run build
sudo systemctl restart domashno
```

The PWA fetches the HTML shell network-first, so users get the new version on reload.

---

## 10. Backups

Everything lives in `server/data/` (SQLite DB + uploaded files):

```bash
# quick snapshot
sudo -u domashno tar czf ~/domashno-backup-$(date +%F).tgz -C /opt/domashno/server data

# restore
sudo systemctl stop domashno
sudo rm -rf /opt/domashno/server/data
sudo tar xzf domashno-backup-YYYY-MM-DD.tgz -C /opt/domashno/server
sudo systemctl start domashno
```

Consider a nightly cron job to copy it off the box.

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| `502` from Caddy | App not running: `systemctl status domashno`, `journalctl -u domashno -n 50` |
| Certificate not issued | DNS not pointing at the VPS, or ports 80/443 blocked |
| Google: `redirect_uri_mismatch` | Add the precise `https://YOUR_DOMAIN/api/auth/google/callback`; changes can take minutes |
| Email sign-in fails | Resend domain not verified, or `EMAIL_FROM` isn't a verified sender |
| Cookies not set / login loops | `APP_URL`/`SERVER_URL` must be the **https** URL, and you must access the site over https |
| Old app version showing | Hard-reload once (the new service worker activates) |
| Uploads rejected | Raise `MAX_UPLOAD_MB` in `.env` **and** Caddy's `max_size` |

---

## Handy commands

```bash
sudo systemctl restart domashno     # restart the app
journalctl -u domashno -f           # live logs
sudo systemctl reload caddy         # reload proxy config
cd /opt/domashno && sudo -u domashno node server/scripts/reset-data.mjs   # wipe all data
```
