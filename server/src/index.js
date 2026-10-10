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

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // we sit behind Caddy/nginx which sets X-Forwarded-For
app.use(express.json({ limit: '3mb' }));
app.use(cookieParser());
app.use(attachUser);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', emailAuthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', apiRouter);

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
