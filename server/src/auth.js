import crypto from 'node:crypto';
import { SESSION_SECRET, IS_PROD, isAdminEmail } from './env.js';
import { sessions, users, classes, members, loginEvents, admin } from './db.js';

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

/** Is this user an admin? (whoever signs in with an ADMIN_EMAIL address) */
export const isAdmin = (user) => Boolean(user && user.email && isAdminEmail(user.email));

/* ------------------------------ fingerprinting ---------------------------- */

const seenRecently = new Map(); // userId -> last write (throttle last_seen updates)
const TOUCH_MS = 60_000;

function touchLastSeen(userId) {
  const last = seenRecently.get(userId) ?? 0;
  if (Date.now() - last < TOUCH_MS) return;
  seenRecently.set(userId, Date.now());
  try { admin.touchLastSeen(userId); } catch { /* ignore */ }
}

/** Record a login event (IP + user-agent + language) for the admin panel. */
export function recordLoginEvent(req, userId) {
  try {
    loginEvents.add({
      userId,
      ip: req.ip || req.socket?.remoteAddress || null,
      userAgent: (req.headers['user-agent'] || '').slice(0, 400) || null,
      acceptLanguage: (req.headers['accept-language'] || '').slice(0, 200) || null,
    });
  } catch (err) {
    console.warn('could not record login event:', err.message);
  }
}

/** Create a session, set the cookie and log the login. */
export function startLogin(req, res, userId) {
  recordLoginEvent(req, userId);
  const session = sessions.create(userId);
  setSessionCookie(res, session.id, session.expires);
  return session;
}

/** Populates req.user when a valid session cookie is present. */
export function attachUser(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = sessions.get(token);
  req.sessionId = session?.id ?? null;
  let user = session ? users.byId(session.user_id) : null;
  if (user && user.banned_at) {
    // banned mid-session → kick them out immediately
    sessions.destroy(session.id);
    clearSessionCookie(res);
    req.sessionId = null;
    user = null;
  }
  req.user = user;
  if (user) touchLastSeen(user.id);
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required' });
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
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
