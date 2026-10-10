import crypto from 'node:crypto';
import express from 'express';
import { SERVER_URL, APP_URL, VERIFICATION_TTL_MIN, EMAIL_PROVIDER, IS_PROD } from './env.js';
import { users, sessions, emailTokens } from './db.js';
import { setSessionCookie } from './auth.js';
import { sendVerificationEmail } from './email.js';
import { badRequest, wrap } from './util.js';
import { publicUser } from './oauth.js';

export const emailAuthRoutes = express.Router();

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function upsertVerifiedUser({ email, name }) {
  const existing = users.byEmail(email);
  if (existing) {
    users.markVerified(existing.id);
    if (name && name !== existing.name) return users.rename(existing.id, name);
    return users.byId(existing.id);
  }
  return users.create({ name: name || email.split('@')[0], email, verified: true });
}

function startSession(res, user) {
  const session = sessions.create(user.id);
  setSessionCookie(res, session.id, session.expires);
}

const CODE_RE = /^\d{6}$/;

/** Send a 6-digit code (and a one-tap link) to the address. */
emailAuthRoutes.post('/email/start', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim().slice(0, 80);
  const locale = req.body?.locale === 'en' ? 'en' : 'bg';
  if (!EMAIL_RE.test(email)) return badRequest(res, 'invalid_email');

  emailTokens.purge();
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  if (emailTokens.recentCount(email, since) >= 5) return res.status(429).json({ error: 'too_many_requests' });

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const secret = crypto.randomBytes(24).toString('base64url');
  const id = crypto.randomUUID();
  emailTokens.create({
    id,
    email,
    name,
    codeHash: sha(code),
    tokenHash: sha(secret),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MIN * 60_000).toISOString(),
  });

  const link = `${SERVER_URL}/api/auth/email/link?id=${id}&t=${secret}`;
  let provider = EMAIL_PROVIDER;
  try {
    provider = await sendVerificationEmail({ to: email, name, code, link, locale, ttlMin: VERIFICATION_TTL_MIN });
  } catch (err) {
    console.error('Verification email failed:', err.message);
    return res.status(502).json({ error: 'email_failed' });
  }

  const payload = { ok: true, email, expiresInMin: VERIFICATION_TTL_MIN, provider };
  // With no mail provider configured, return the code so local setups still work.
  if (provider === 'console' && !IS_PROD) {
    payload.devCode = code;
    payload.devLink = link;
  }
  res.json(payload);
}));

/** Confirm the code and, only now, open a session. */
emailAuthRoutes.post('/email/verify', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').replace(/\D/g, '');
  if (!EMAIL_RE.test(email) || !CODE_RE.test(code)) return badRequest(res, 'invalid_code');

  const row = emailTokens.latest(email);
  if (!row || new Date(row.expires_at) < new Date()) return badRequest(res, 'code_expired');
  if (row.attempts >= 6) return res.status(429).json({ error: 'too_many_attempts' });
  if (!safeEqual(sha(code), row.code_hash)) {
    emailTokens.bumpAttempts(row.id);
    return badRequest(res, 'invalid_code');
  }

  emailTokens.consume(row.id);
  const user = upsertVerifiedUser({ email, name: row.name });
  startSession(res, user);
  res.json({ user: publicUser(user) });
}));

/** One-tap sign-in from the email link. */
emailAuthRoutes.get('/email/link', (req, res) => {
  const id = String(req.query.id || '');
  const t = String(req.query.t || '');
  const row = id ? emailTokens.byId(id) : null;
  const fail = () => res.redirect(`${APP_URL}/login?error=link`);
  if (!row || row.consumed_at || new Date(row.expires_at) < new Date()) return fail();
  if (!safeEqual(sha(t), row.token_hash)) return fail();

  emailTokens.consume(row.id);
  const user = upsertVerifiedUser({ email: row.email, name: row.name });
  startSession(res, user);
  res.redirect(`${APP_URL}/`);
});
