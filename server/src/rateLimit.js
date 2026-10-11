// Rate limiting.
//
// Built on the `express-rate-limit` package (memory store) rather than a
// hand-rolled limiter — it handles IPv6 subnets, proxy headers and the standard
// `RateLimit-*` response header correctly, and static analysis recognises it.
//
// Keys are per client IP (the real IP arrives via X-Forwarded-For, see `trust proxy`).

import { rateLimit as expressRateLimit } from 'express-rate-limit';

const disabled = () => String(process.env.RATE_LIMIT_DISABLED || '') === '1';

export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * @param {object} opts
 * @param {number} opts.windowMs  window length in ms
 * @param {number} opts.max       allowed hits per window
 * @param {string} opts.name      human label (documentation only)
 */
export function rateLimit(opts = {}) {
  const { windowMs = 60_000, max = 60 } = opts;
  return expressRateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    skip: disabled,
    handler: (_req, res) => res.status(429).json({ error: 'too_many_requests' }),
    validate: { xForwardedForHeader: false },
  });
}

/** Peek for diagnostics. */
export function rateLimitStats() {
  return { store: 'memory' };
}

/** Best-effort IP+UA fingerprint (used for admin login logs). */
export function fingerprint(req, extra = '') {
  const ua = String(req.headers['user-agent'] || '').slice(0, 60);
  return `${clientIp(req)}|${ua}${extra ? `|${extra}` : ''}`;
}
