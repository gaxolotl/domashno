// Generate the PWA icons + favicon without any image dependency.
// Mark: a rounded green tile holding a planner page with a lime index tab and a check.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const GREEN = [30, 122, 76];
const WHITE = [255, 255, 255];
const LIME = [199, 232, 107];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * clamp01(t)));

/* --- shape coverage (anti-aliased, in pixel space) ------------------------- */

// signed distance to a rounded rectangle (negative inside)
function sdfRoundRect(px, py, x0, y0, x1, y1, r) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hx = Math.max(0, (x1 - x0) / 2 - r);
  const hy = Math.max(0, (y1 - y0) / 2 - r);
  const qx = Math.abs(px - cx) - hx;
  const qy = Math.abs(py - cy) - hy;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function capsuleDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/* --- render ---------------------------------------------------------------- */

function render(size, { bleed = false } = {}) {
  const px = new Uint8Array(size * size * 4);
  const u = size / 100; // 1 design unit in pixels
  const P = (v) => v * u;

  // design-space geometry
  const tile = bleed ? [0, 0, 100, 100, 0] : [3, 3, 97, 97, 26];
  const page = [24, 15, 76, 85, 9];
  const tab = [67, 20, 87, 41, 6];
  const A = [34, 64];
  const B = [44, 75];
  const C = [63, 51];
  const strokeHalf = (9 / 2) * u;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x + 0.5;
      const sy = y + 0.5;
      const i = (y * size + x) * 4;

      const tileCov = clamp01(0.5 - sdfRoundRect(sx, sy, P(tile[0]), P(tile[1]), P(tile[2]), P(tile[3]), P(tile[4])));
      if (tileCov <= 0) { px[i + 3] = 0; continue; }

      let col = GREEN;
      const pageCov = clamp01(0.5 - sdfRoundRect(sx, sy, P(page[0]), P(page[1]), P(page[2]), P(page[3]), P(page[4])));
      if (pageCov > 0) col = mix(col, WHITE, pageCov);

      const tabCov = clamp01(0.5 - sdfRoundRect(sx, sy, P(tab[0]), P(tab[1]), P(tab[2]), P(tab[3]), P(tab[4])));
      if (tabCov > 0) col = mix(col, LIME, tabCov);

      const d = Math.min(
        capsuleDist(sx, sy, P(A[0]), P(A[1]), P(B[0]), P(B[1])),
        capsuleDist(sx, sy, P(B[0]), P(B[1]), P(C[0]), P(C[1])),
      );
      const checkCov = clamp01(0.5 - (d - strokeHalf));
      if (checkCov > 0) col = mix(col, GREEN, checkCov);

      px[i] = col[0];
      px[i + 1] = col[1];
      px[i + 2] = col[2];
      px[i + 3] = Math.round(tileCov * 255);
    }
  }
  return px;
}

/* --- png encoding ---------------------------------------------------------- */

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

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="3" y="3" width="94" height="94" rx="26" fill="#1E7A4C"/>
  <rect x="24" y="15" width="52" height="70" rx="9" fill="#FFFFFF"/>
  <rect x="67" y="20" width="20" height="21" rx="6" fill="#C7E86B"/>
  <path d="M34 64 L44 75 L63 51" fill="none" stroke="#1E7A4C" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
fs.writeFileSync(path.resolve(__dirname, '..', 'public', 'favicon.svg'), svg);
console.log('wrote favicon.svg');
