// Tiny in-memory rate limiter (single-process friendly). Keyed by client
// fingerprint — primarily the client IP, with an optional extra segment.
//
// Behind a reverse proxy the real IP comes from X-Forwarded-For thanks to
// `app.set('trust proxy', 1)`.

const buckets = new Map();

// periodically drop expired buckets so the map can't grow forever
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (now > b.reset) buckets.delete(key);
}, 60_000);
sweeper.unref?.();

/** Best-effort client fingerprint: IP (+ optional discriminator). */
export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function fingerprint(req, extra = '') {
  const ua = String(req.headers['user-agent'] || '').slice(0, 60);
  return `${clientIp(req)}|${ua}${extra ? `|${extra}` : ''}`;
}

/**
 * @param {object} opts
 * @param {number} opts.windowMs  window length
 * @param {number} opts.max       allowed hits per window
 * @param {string} opts.name      bucket namespace
 * @param {(req)=>string} [opts.key]  custom key function
 */
export function rateLimit({ windowMs = 60_000, max = 60, name = 'rl', key } = {}) {
  const disabled = String(process.env.RATE_LIMIT_DISABLED || '') === '1';
  return (req, res, next) => {
    if (disabled) return next();

    const k = `${name}:${key ? key(req) : clientIp(req)}`;
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || now > b.reset) {
      b = { count: 0, reset: now + windowMs };
      buckets.set(k, b);
    }
    b.count += 1;

    const resetSec = Math.ceil((b.reset - now) / 1000);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - b.count)));
    res.setHeader('RateLimit-Reset', String(resetSec));

    if (b.count > max) {
      res.setHeader('Retry-After', String(resetSec));
      return res.status(429).json({ error: 'too_many_requests' });
    }
    next();
  };
}

/** Peek without consuming (handy for tests / logs). */
export function rateLimitStats() {
  return { buckets: buckets.size };
}
