import crypto from 'node:crypto';
import { SESSION_SECRET, IS_PROD } from './env.js';
import { sessions, users, classes, members } from './db.js';

export const SESSION_COOKIE = 'domashno_session';

function hmac(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

/** Sign an arbitrary small JSON payload for short-lived OAuth round-trips. */
export function signValue(obj) {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

export function verifyValue(signed) {
  if (typeof signed !== 'string' || !signed.includes('.')) return null;
  const [payload, sig] = signed.split('.');
  const expected = hmac(payload);
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function setSessionCookie(res, token, expires) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    expires,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Populates req.user when a valid session cookie is present. */
export function attachUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = sessions.get(token);
  req.sessionId = session?.id ?? null;
  req.user = session ? users.byId(session.user_id) : null;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required' });
  next();
}

/** Membership helper. Returns the membership row or null. */
export function membershipOf(req, classId) {
  if (!req.user) return null;
  return members.get(classId, req.user.id);
}

export function requireMembership(classIdResolver) {
  return (req, res, next) => {
    const classId =
      typeof classIdResolver === 'function' ? classIdResolver(req) : req.params[classIdResolver] ?? req.params.id;
    const cls = classes.byId(classId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    const membership = membershipOf(req, classId);
    if (!membership) return res.status(403).json({ error: 'Not a member of this class' });
    req.classId = classId;
    req.cls = cls;
    req.membership = membership;
    next();
  };
}

export const isOwner = (req) => req.membership?.role === 'owner';
