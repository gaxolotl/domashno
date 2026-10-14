# Deploying Домашно on a VPS

Target: a fresh Debian/Ubuntu VPS, a domain or subdomain, ~10 minutes.
Stack: Node + SQLite, served behind **nginx** with a free Let's Encrypt certificate
(via certbot). Everything comes from the distro's own package repos, so nothing
depends on third-party apt repos.

Throughout, replace:

- `YOUR_DOMAIN` → e.g. `domashno.catweb.top`
- `YOUR_EMAIL` → your email (for Let's Encrypt notices)

---

## 0. What you need

- A VPS with a public IPv4 and root/sudo access.
- DNS access for your domain.
- Node **20+** (22 recommended).
- Optional: a Resend API key for email sign-in — https://resend.com

---

## 1. Point DNS at the server

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `domashno` (or `@`) | `YOUR_SERVER_IP` | 300 |

```bash
dig +short YOUR_DOMAIN      # should print your server IP
```

---

## 2. Install Node 22, nginx and certbot

```bash
sudo apt update
sudo apt install -y curl git build-essential python3 ca-certificates

# Node 22 (NodeSource) — brings its own npm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v

# Web server + free TLS certificates (from Debian/Ubuntu repos)
sudo apt install -y nginx certbot python3-certbot-nginx
```

> **If the NodeSource step fails with an apt error, run `sudo apt update` alone and
> fix whatever repo it complains about first** (see Troubleshooting → "402 Payment Required").

---

## 3. Put the code on the server

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin domashno
sudo mkdir -p /opt/domashno
sudo chown domashno:domashno /opt/domashno

sudo -u domashno git clone https://github.com/gaxolotl/domashno.git /opt/domashno
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

The server serves `web/dist` itself, so one process runs the API **and** the app.

---

## 5. Configure `.env`

```bash
sudo -u domashno cp .env.production.example .env
sudo -u domashno nano .env
```

Minimum:

```ini
NODE_ENV=production
PORT=8787
APP_URL=https://YOUR_DOMAIN
SERVER_URL=https://YOUR_DOMAIN
SESSION_SECRET=...            # see below
ENABLE_DEV_LOGIN=0
ADMIN_EMAIL=you@YOUR_DOMAIN   # whoever signs in with this email can open /admin
EMAIL_FROM="Домашно <noreply@YOUR_DOMAIN>"
RESEND_API_KEY=re_xxxxxxxx    # for email sign-in
GOOGLE_CLIENT_ID=...          # optional
GOOGLE_CLIENT_SECRET=...
```

### Turnstile (bot check) + legal contact

The login page shows a Cloudflare Turnstile widget and requires accepting the
Terms (`/terms`) and Privacy Policy (`/privacy`). Both pages are built into the
app in Bulgarian and English.

1. Go to Cloudflare dashboard → **Turnstile** → **Add widget**, using your
   domain. Copy the **site key** and **secret key** into `.env`:

```ini
TURNSTILE_SITE_KEY=0x...
TURNSTILE_SECRET_KEY=0x...
LEGAL_CONTACT_EMAIL=you@YOUR_DOMAIN   # shown as the contact on both pages
```

Leave the Turnstile keys empty to disable the check (local testing only —
the login endpoints accept requests without a token then).

Have your school/operator review the texts in `web/src/features/legal/legalContent.ts` —
they are written in plain language with a GDPR structure, but they are
templates, not legal advice.

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomUUID()+require('crypto').randomUUID())"
```

Sanity check:

```bash
cd /opt/domashno && sudo -u domashno node -e "import('./server/src/env.js').then(e=>console.log(e.APP_URL,e.EMAIL_PROVIDER,e.ENABLE_DEV_LOGIN))"
```

---

## 6. Run it as a service

```bash
sudo cp deploy/domashno.service /etc/systemd/system/domashno.service
sudo systemctl daemon-reload
sudo systemctl enable --now domashno
sudo systemctl status domashno        # active (running)
curl -s localhost:8787/api/health     # {"ok":true}
```

Logs: `journalctl -u domashno -f`

---

## 7. HTTPS with nginx + certbot

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/domashno
sudo nano /etc/nginx/sites-available/domashno     # set server_name YOUR_DOMAIN
sudo ln -sf /etc/nginx/sites-available/domashno /etc/nginx/sites-enabled/domashno
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# get a certificate and enable the HTTPS redirect
sudo certbot --nginx -d YOUR_DOMAIN --agree-tos -m YOUR_EMAIL --redirect
```

Open `https://YOUR_DOMAIN` — sign-in page with a valid padlock. ✅

> Prefer Caddy? A `deploy/Caddyfile.example` is included. Note Caddy's apt repo has
> been returning `402 Payment Required`; if that happens, download the static binary
> from https://github.com/caddyserver/caddy/releases instead of using apt.

---

## 8. First sign-in

1. Open `https://YOUR_DOMAIN`.
2. Sign in with **Google**, or with **email** (you get a 6-digit code).
3. Create your class → **Edit** → **Choose PDF** → upload the Shkolo PDF → review → **Save**.
4. Invite classmates with the invite code (Class tab).

**Update the OAuth redirect URL** (Google Cloud console → your OAuth client →
Authorized redirect URIs): add

```
https://YOUR_DOMAIN/api/auth/google/callback
```

**Verify your email domain** (Resend → Domains → add `YOUR_DOMAIN` + its DNS records).
Until it's verified, email sign-in fails with `email_failed`.

---

## 9. Updating later

```bash
cd /opt/domashno
sudo -u domashno git pull
sudo -u domashno npm ci
sudo -u domashno npm run build
sudo systemctl restart domashno
```

---

## 10. Backups

All state is in `server/data/` (SQLite DB + uploaded files):

```bash
sudo -u domashno tar czf ~/domashno-$(date +%F).tgz -C /opt/domashno/server data

# restore
sudo systemctl stop domashno
sudo rm -rf /opt/domashno/server/data
sudo tar xzf domashno-YYYY-MM-DD.tgz -C /opt/domashno/server
sudo systemctl start domashno
```

---

## 11. Troubleshooting

**`402 Payment Required` on `apt update`**
A third-party repo is down. Find and remove it:
```bash
grep -rl "cloudsmith" /etc/apt/sources.list.d/ 2>/dev/null
sudo rm -f /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
```
(Swap `caddy-stable` for whatever file it names.)

| Symptom | Fix |
|---|---|
| `502` / blank page | App down: `systemctl status domashno`, `journalctl -u domashno -n 50` |
| Certbot can't validate | DNS not pointing here, or port 80 blocked (`sudo ufw allow 80,443/tcp`) |
| Google `redirect_uri_mismatch` | Add the exact `https://YOUR_DOMAIN/api/auth/google/callback`; may take minutes |
| Email sign-in fails | Resend domain not verified, or `EMAIL_FROM` sender not verified |
| Login loops / no cookie | `APP_URL`/`SERVER_URL` must be the **https** URL and you must use https |
| `npm: command not found` | Install Node from NodeSource (step 2), not just Debian's `nodejs` |
| Old app in the browser | Hard-reload once so the new service worker activates |
| Uploads rejected | Raise `MAX_UPLOAD_MB` and nginx `client_max_body_size` |

---

## Handy commands

```bash
sudo systemctl restart domashno     # restart the app
journalctl -u domashno -f           # live logs
sudo systemctl reload nginx         # reload proxy config
cd /opt/domashno && sudo -u domashno node server/scripts/reset-data.mjs   # wipe all data
```
