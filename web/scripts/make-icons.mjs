// Generate the PWA icons + favicon without any image dependency.
// Draws a rounded green tile with a chalk-white check and a highlighter underline.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const PRIMARY = [30, 122, 76];
const PRIMARY_DARK = [30, 122, 76];
const ACCENT = [199, 232, 107];
const WHITE = [255, 255, 255];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * clamp01(t)));

// coverage of a capsule (thick line) at a point
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function render(size, { bleed = false } = {}) {
  const px = new Uint8Array(size * size * 4);
  const pad = bleed ? 0 : size * 0.14;
  const r = bleed ? 0 : size * 0.22;

  // rounded-rect signed distance (negative inside)
  const inTile = (x, y) => {
    if (r === 0) return true;
    const cx = Math.max(r, Math.min(size - r, x));
    const cy = Math.max(r, Math.min(size - r, y));
    return Math.hypot(x - cx, y - cy) <= r;
  };

  const unit = (size - pad * 2) / 100; // design space is 100x100
  const P = (v) => pad + v * unit;
  // check mark
  const A = [30, 52], B = [44, 66], C = [72, 34];
  const thick = 8.5 * unit;
  const uThick = 6.5 * unit;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!inTile(x + 0.5, y + 0.5)) {
        px[i + 3] = 0;
        continue;
      }
      // gradient background
      let col = mix(PRIMARY, PRIMARY_DARK, (x + y) / (2 * size));
      // highlighter underline
      const dUnder = segDist(x, y, P(26), P(80), P(74), P(80));
      if (dUnder < 5.5 * unit) col = mix(col, ACCENT, clamp01((5.5 * unit - dUnder) / (1.5 * unit)));
      // check
      const d = Math.min(segDist(x, y, P(A[0]), P(A[1]), P(B[0]), P(B[1])), segDist(x, y, P(B[0]), P(B[1]), P(C[0]), P(C[1])));
      if (d < thick) col = mix(col, WHITE, clamp01((thick - d) / (1.6 * unit)));
      px[i] = col[0];
      px[i + 1] = col[1];
      px[i + 2] = col[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const write = (name, size, opts) => {
  fs.writeFileSync(path.join(OUT, name), png(size, render(size, opts)));
  console.log('wrote', name, `${size}x${size}`);
};

write('icon-192.png', 192);
write('icon-512.png', 512);
write('icon-maskable-512.png', 512, { bleed: true });
write('apple-touch-icon.png', 180);
write('favicon-32.png', 32);

// SVG favicon (crisp at any size)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="4" y="4" width="92" height="92" rx="22" fill="#1E7A4C"/>
  <path d="M30 52 L44 66 L72 34" fill="none" stroke="#fff" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="26" y="76" width="48" height="9" rx="4.5" fill="#C7E86B"/>
</svg>`;
fs.writeFileSync(path.resolve(__dirname, '..', 'public', 'favicon.svg'), svg);
console.log('wrote favicon.svg');
