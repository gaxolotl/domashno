import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import {
  PORT, APP_URL, SERVER_URL, IS_PROD, WEB_DIST, oauthEnabled, ENABLE_DEV_LOGIN, EMAIL_PROVIDER,
} from './env.js';
import { attachUser } from './auth.js';
import { authRoutes } from './oauth.js';
import { emailAuthRoutes } from './emailAuth.js';
import { apiRouter } from './api.js';
import { adminRoutes } from './admin.js';
import { cdnRoutes } from './cdn.js';
import { rateLimit } from './rateLimit.js';
import { issueCsrf, requireCsrf } from './csrf.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // we sit behind Caddy/nginx which sets X-Forwarded-For
app.use(express.json({ limit: '3mb' }));
app.use(cookieParser());

// Coarse per-IP ceiling for *every* request (routes add their own tighter limits).
app.use(rateLimit({ name: 'global', windowMs: 60_000, max: 600 }));

// CSRF: give everyone a token, then require it on state-changing API calls.
app.use(issueCsrf);
app.use(attachUser);
app.use('/api', requireCsrf);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', emailAuthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', cdnRoutes);
app.use('/api', apiRouter);

// Machine-readable capability manifest (Agentic Browsing / ARD): this app
// exposes no agent-callable resources, so the catalog is honestly empty.
// Served dynamically (not from web/dist) so absolute URLs always match the
// deployment's own domain. Mounted on both paths auditors check.
function aiCatalog(req, res) {
  const host = siteHost(req);
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({
    specVersion: '1.0',
    host: {
      displayName: 'Домашно',
      identifier: `did:web:${host}`,
      documentationUrl: 'https://github.com/gaxolotl/domashno',
      logoUrl: `https://${host}/icons/icon-512.png`,
    },
    entries: [],
  });
}
app.get('/ai-catalog.json', aiCatalog);
app.get('/.well-known/ai-catalog.json', aiCatalog);

// robots.txt + sitemap.xml are served dynamically (not from web/dist) so the
// Sitemap URL and all listed URLs are absolute and always match this
// deployment's own domain. Crawling is allowed: only logged-out pages
// (/, /login, /terms, /privacy) are visible without sign-in anyway.
function siteHost(req) {
  return String(req.get('host') || '').split(',')[0].trim() || 'localhost';
}
app.get('/robots.txt', (req, res) => {
  const host = siteHost(req);
  res.set('Cache-Control', 'public, max-age=86400');
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: https://${host}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  const host = siteHost(req);
  const base = `https://${host}`;
  const urls = ['/', '/login', '/terms', '/privacy']
    .map((p) => `  <url><loc>${base}${p}</loc></url>`)
    .join('\n');
  res.set('Cache-Control', 'public, max-age=86400');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
});

// Serve the built PWA when it exists (production / `npm run build`).
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? 'That file is too large'
    : err.message || 'Something went wrong';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  const providers = ['google', 'github'].filter(oauthEnabled);
  console.log(`\n  Домашно · server listening on ${SERVER_URL}`);
  console.log(`  App URL:   ${APP_URL}`);
  console.log(`  Sign-in:   ${providers.length ? providers.join(', ') : 'none configured'}${ENABLE_DEV_LOGIN ? ' + dev login' : ''}`);
  console.log(`  Email:     ${EMAIL_PROVIDER}${EMAIL_PROVIDER === 'console' ? ' (codes printed to this log)' : ''}`);
  if (!providers.length && EMAIL_PROVIDER === 'console' && !ENABLE_DEV_LOGIN) {
    console.log('  ⚠ No sign-in method works for real users yet. Set RESEND_API_KEY/SMTP or OAuth keys.');
  }
  console.log(`  Mode:      ${IS_PROD ? 'production' : 'development'}\n`);
});
