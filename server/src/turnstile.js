// Cloudflare Turnstile verification (bot protection for the login endpoints).
//
// When no keys are configured the check is skipped entirely, so local setups
// keep working without internet access. In production set TURNSTILE_SITE_KEY
// and TURNSTILE_SECRET_KEY (Cloudflare dashboard → Turnstile).

import { TURNSTILE, turnstileEnabled } from './env.js';

export { turnstileEnabled };

/**
 * Verify a Turnstile token with Cloudflare.
 * @returns true when the token is valid, or when Turnstile is not configured.
 */
export async function verifyTurnstile(token, ip) {
  if (!turnstileEnabled()) return true;
  if (!token || typeof token !== 'string') return false;
  let res;
  try {
    res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: TURNSTILE.secretKey,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return false; // fail closed: a bot check we cannot run does not pass
  }
  if (!res.ok) return false;
  try {
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/** Express helper: 400 unless the request carries a valid Turnstile token. */
export function requireTurnstile(getToken) {
  return async (req, res, next) => {
    if (!turnstileEnabled()) return next();
    const ok = await verifyTurnstile(getToken(req), req.ip || req.socket?.remoteAddress);
    if (!ok) return res.status(400).json({ error: 'turnstile_failed' });
    next();
  };
}

/** Express helper: 400 unless the request confirms the Terms + Privacy Policy. */
export function requireTerms(getFlag) {
  return (req, res, next) => {
    if (getFlag(req) !== true) return res.status(400).json({ error: 'terms_required' });
    next();
  };
}
