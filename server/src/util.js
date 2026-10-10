import { randomUUID, randomBytes } from 'node:crypto';

export const newId = () => randomUUID();
export const newToken = () => randomBytes(32).toString('base64url');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

export function newInviteCode(length = 6) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

export function notFound(res, message = 'Not found') {
  return res.status(404).json({ error: message });
}

export function forbidden(res, message = 'Not allowed') {
  return res.status(403).json({ error: message });
}

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// Icon fonts (Shkolo uses one for its subject/teacher pictograms) put glyphs in the
// Unicode Private Use Area. Those render as blank boxes, so strip them — along with
// other invisible/formatting characters — before any text is stored.
const INVISIBLE_RE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF\uFFFD\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu;

export function sanitizeText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\u00A0/g, ' ') // non-breaking space
    .replace(INVISIBLE_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Wrap an async express handler so thrown errors reach the error middleware.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
