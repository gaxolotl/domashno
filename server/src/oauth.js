import crypto from 'node:crypto';
import express from 'express';
import { Google, GitHub } from 'arctic';
import { OAUTH, IS_PROD, callbackUrl, oauthEnabled, ENABLE_DEV_LOGIN } from './env.js';
import { users, sessions } from './db.js';
import {
  signValue, verifyValue, setSessionCookie, clearSessionCookie, startLogin, isAdmin,
} from './auth.js';
import { rateLimit } from './rateLimit.js';
import { badRequest, wrap } from './util.js';

const router = express.Router();

const oauthStartLimit = rateLimit({ name: 'oauth-start', windowMs: 15 * 60_000, max: 40 });
const devLoginLimit = rateLimit({ name: 'dev-login', windowMs: 15 * 60_000, max: 10 });

const STATE_COOKIE = 'domashno_oauth';

function providers() {
  const list = {};
  if (oauthEnabled('google')) {
    list.google = new Google(OAUTH.google.id, OAUTH.google.secret, callbackUrl('google'));
  }
  if (oauthEnabled('github')) {
    list.github = new GitHub(OAUTH.github.id, OAUTH.github.secret, callbackUrl('github'));
  }
  return list;
}

/** Upsert a user from an OAuth profile. OAuth emails are provider-verified. */
function upsertUser({ provider, providerUserId, name, email, avatar }) {
  const identity = users.findIdentity(provider, providerUserId);
  if (identity) {
    const existing = users.byId(identity.user_id);
    if (existing) {
      users.markVerified(existing.id);
      if (name && name !== existing.name) return users.rename(existing.id, name);
      return existing;
    }
  }
  let user = email ? users.byEmail(email) : null;
  if (user) users.markVerified(user.id);
  else user = users.create({ name: name || 'Ученик', email, avatar_url: avatar || null, verified: true });
  users.linkIdentity(provider, providerUserId, user.id);
  return users.byId(user.id);
}

async function googleProfile(accessToken) {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Google profile request failed');
  const p = await res.json();
  return { providerUserId: p.sub, name: p.name || p.email, email: p.email, avatar: p.picture };
}

async function githubProfile(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'domashno', Accept: 'application/vnd.github+json' };
  const res = await fetch('https://api.github.com/user', { headers });
  if (!res.ok) throw new Error('GitHub profile request failed');
  const p = await res.json();
  let email = p.email;
  if (!email) {
    const er = await fetch('https://api.github.com/user/emails', { headers });
    if (er.ok) {
      const emails = await er.json();
      const primary = emails.find((e) => e.primary) || emails.find((e) => e.verified);
      email = primary?.email || null;
    }
  }
  return { providerUserId: String(p.id), name: p.name || p.login, email, avatar: p.avatar_url };
}

router.get('/providers', rateLimit({ name: 'providers', windowMs: 60_000, max: 120 }), (_req, res) => {
  res.set('Cache-Control', 'no-store'); // config can change when keys are added
  res.json({
    google: oauthEnabled('google'),
    github: oauthEnabled('github'),
    dev: ENABLE_DEV_LOGIN,
  });
});

router.get('/:provider/start', oauthStartLimit, (req, res) => {
  const provider = req.params.provider;
  const client = providers()[provider];
  if (!client || !['google', 'github'].includes(provider)) {
    return badRequest(res, 'Unknown provider');
  }
  const state = crypto.randomUUID();
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
  res.cookie(STATE_COOKIE, signValue({ state, codeVerifier, provider }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const url = provider === 'google'
    ? client.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile'])
    : client.createAuthorizationURL(state, ['read:user', 'user:email']);

  res.redirect(url.toString());
});

router.get('/:provider/callback', oauthStartLimit, wrap(async (req, res) => {
  const provider = req.params.provider;
  const client = providers()[provider];
  if (!client || !['google', 'github'].includes(provider)) return badRequest(res, 'Unknown provider');

  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  if (!code) return badRequest(res, 'Missing authorization code');

  const saved = verifyValue(req.cookies?.[STATE_COOKIE]);
  res.clearCookie(STATE_COOKIE, { path: '/' });
  if (!saved || saved.provider !== provider || saved.state !== state) {
    return badRequest(res, 'Invalid or expired OAuth state');
  }

  let tokens;
  try {
    tokens = provider === 'google'
      ? await client.validateAuthorizationCode(code, saved.codeVerifier)
      : await client.validateAuthorizationCode(code);
  } catch {
    return res.redirect(`${envAppUrl()}/login?error=oauth`);
  }

  const accessToken = tokens.accessToken();
  const profile = provider === 'google'
    ? await googleProfile(accessToken)
    : await githubProfile(accessToken);

  const user = upsertUser({ provider, ...profile });
  if (user.banned_at) return res.redirect(`${envAppUrl()}/login?error=banned`);
  startLogin(req, res, user.id);
  res.redirect(`${envAppUrl()}/`);
}));

/** Dev login: create or reuse a user by name + email. Only for local testing. */
router.post('/dev', devLoginLimit, wrap(async (req, res) => {
  if (!ENABLE_DEV_LOGIN) return res.status(404).json({ error: 'Not available' });
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase() || null;
  if (!name) return badRequest(res, 'Name is required');
  let user = email ? users.byEmail(email) : null;
  if (user) {
    users.markVerified(user.id);
    user = users.byId(user.id);
  } else {
    user = users.create({ name, email, verified: true });
  }
  if (user.banned_at) return res.status(403).json({ error: 'banned' });
  startLogin(req, res, user.id);
  res.json({ user: publicUser(user) });
}));

router.post('/logout', (req, res) => {
  if (req.sessionId) sessions.destroy(req.sessionId);
  clearSessionCookie(res);
  res.json({ ok: true });
});

/** Exposed so index.js can show a helpful setup screen. */
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: Boolean(user.email_verified),
    avatar_url: user.avatar_url,
    is_admin: isAdmin(user),
  };
}

function envAppUrl() {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
}

export { router as authRoutes };
