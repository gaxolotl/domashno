import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from './env.js';

const CACHE_DIR = path.join(UPLOAD_DIR, '.thumbs');
fs.mkdirSync(CACHE_DIR, { recursive: true });

// Only these widths are produced (and cached) — keeps the variant set bounded.
export const THUMB_WIDTHS = [160, 320, 480, 800, 1200, 1600];
const QUALITIES = [55, 70, 82];

const nearest = (list, v) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), list[0]);

/**
 * Parse `?w=`/`?q=` and snap to a cached variant.
 * Returns null when the caller didn't ask for a resize.
 */
export function parseImageParams(query) {
  const raw = Number(query?.w);
  if (!Number.isFinite(raw)) return null;
  const width = nearest(THUMB_WIDTHS, Math.min(2000, Math.max(40, Math.round(raw))));
  const qRaw = Number(query?.q);
  const quality = QUALITIES.includes(qRaw) ? qRaw : 70;
  return { width, quality };
}

/** Create (or reuse) a resized WebP for an image. */
export async function ensureThumb(filePath, { width, quality }) {
  const out = path.join(CACHE_DIR, `${path.basename(filePath)}.${width}.${quality}.webp`);
  try {
    if (fs.statSync(out).size > 0) return out;
  } catch {
    /* not cached yet */
  }
  const { default: sharp } = await import('sharp');
  await sharp(filePath, { failOn: 'none', animated: false })
    .rotate() // honour EXIF orientation (phone photos)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toFile(out);
  return out;
}

/** Remove every cached variant of a stored file (on delete). */
export function dropThumbs(storedName) {
  try {
    for (const f of fs.readdirSync(CACHE_DIR)) {
      if (f.startsWith(`${storedName}.`)) fs.rmSync(path.join(CACHE_DIR, f), { force: true });
    }
  } catch {
    /* ignore */
  }
}
