// CSRF protection — double-submit cookie pattern.
//
// A random token lives in a readable cookie; every state-changing request must
// echo it in the `X-CSRF-Token` header. A cross-site page can send cookies but
// cannot read them, so it cannot produce the matching header. Combined with the
// `SameSite=Lax` session cookie this blocks CSRF.
//
// Safe methods (GET/HEAD/OPTIONS) are never blocked, so the OAuth redirect
// callbacks keep working.

import crypto from 'node:crypto';
import { IS_PROD } from './env.js';

export const CSRF_COOKIE = 'domashno_csrf';
export const CSRF_HEADER = 'x-csrf-token';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Give every visitor a token (including anonymous ones, so login forms work). */
export function issueCsrf(req, res, next) {
  const existing = req.cookies?.[CSRF_COOKIE];
  if (!existing) {
    const token = crypto.randomBytes(32).toString('base64url');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // must be readable by the app to echo it back
      sameSite: 'lax',
      secure: IS_PROD,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    req.cookies = req.cookies || {};
    req.cookies[CSRF_COOKIE] = token;
  }
  next();
}

/** Reject state-changing requests whose header does not match the cookie. */
export function requireCsrf(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get(CSRF_HEADER);
  if (!cookie || !header || cookie.length !== header.length) {
    return res.status(403).json({ error: 'csrf_token_invalid' });
  }
  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'csrf_token_invalid' });
  }
  next();
}
