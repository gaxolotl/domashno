// Branding image generator.
//
//   node scripts/make-branding.mjs
//
// The art is authored as vector SVG and rasterised with sharp, so every glyph is
// crisp. Embedded app screenshots are pre-scaled (Lanczos) to exactly the pixel
// size they are drawn at, so the renderer never resamples them — that is what
// keeps the phone mock-ups sharp.
//
// Outputs docs/*.png (README / GitHub) and web/public/branding/*.png (served, og:image).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(SERVER, '..');
const WEB = path.join(ROOT, 'web');
const SHOTS = path.join(WEB, 'branding', 'shots');
const ICONS = path.join(WEB, 'public', 'icons');

const GREEN = '#1E7A4C';
const INK = '#14231C';
const MUTED = '#5C6E63';
const BG = '#EEF2EC';
const LIME = '#C7E86B';
const WHITE = '#FFFFFF';

const FONT = "'Segoe UI', Arial, Helvetica, sans-serif";

/** Output scale — 1.4 is crisp on retina while screenshots stay ~1:1. */
const SCALE = 1.4;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dataUri = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;

const rrect = ({ x, y, w, h, r = 0, fill, opacity = 1 }) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;

const text = (x, y, size, content, { weight = 400, fill = INK, spacing = 0, anchor = 'start', opacity = 1 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}"` +
  `${spacing ? ` letter-spacing="${spacing}"` : ''}${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}` +
  `${opacity !== 1 ? ` opacity="${opacity}"` : ''}>${esc(content)}</text>`;

const grid = (w, h, color, opacity = 0.05) => `
  <defs>
    <pattern id="pgrid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="${color}" stroke-width="1" stroke-opacity="${opacity}"/>
    </pattern>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#pgrid)"/>`;

/* ------------------------- text measurement (exact) ------------------------ */

const measureCache = new Map();

/** Measure the ink box of a string so padding can be exact (SVG has no layout). */
async function measureText(str, size, weight = 400, spacing = 0) {
  const key = `${size}|${weight}|${spacing}|${str}`;
  if (measureCache.has(key)) return measureCache.get(key);
  const pad = 60;
  const W = Math.ceil(size * (str.length + 2) * 0.75) + pad * 2;
  const H = Math.ceil(size * 2.4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <text x="${pad}" y="${Math.round(size * 1.7)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}"${spacing ? ` letter-spacing="${spacing}"` : ''} fill="#000">${esc(str)}</text>
  </svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let maxX = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  const res = maxX < 0 ? { width: 0, left: 0 } : { width: maxX - minX + 1, left: minX - pad };
  measureCache.set(key, res);
  return res;
}

/* --------------------------- screenshots (exact) --------------------------- */

const shotCache = new Map();

/** Resize a shot to the exact device pixels it will occupy, so no resampling happens. */
async function prepareShot(file, phoneWidth) {
  const pad = Math.round(phoneWidth * 0.03);
  const dispW = phoneWidth - pad * 2;
  const deviceWidth = Math.round(dispW * SCALE);
  const key = `${file}@${deviceWidth}`;
  if (shotCache.has(key)) return shotCache.get(key);
  const buf = await sharp(path.join(SHOTS, file))
    .resize({ width: deviceWidth, kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const meta = await sharp(buf).metadata();
  const res = { uri: `data:image/png;base64,${buf.toString('base64')}`, w: meta.width, h: meta.height };
  shotCache.set(key, res);
  return res;
}

/** A phone mock-up containing a prepared screenshot. */
function phone(id, x, y, w, p, rotate = 0) {
  const pad = Math.round(w * 0.03);
  const dispW = w - pad * 2;
  const dispH = dispW * (p.h / p.w);
  const bezel = dispH + pad * 2;
  const rad = Math.round(w * 0.115);
  return `<g transform="translate(${x} ${y})${rotate ? ` rotate(${rotate} ${w / 2} ${bezel / 2})` : ''}">
    <rect x="4" y="10" width="${w}" height="${bezel}" rx="${rad}" fill="#000000" opacity="0.22"/>
    <rect x="0" y="0" width="${w}" height="${bezel}" rx="${rad}" fill="#0d1512"/>
    <clipPath id="${id}"><rect x="${pad}" y="${pad}" width="${dispW}" height="${dispH}" rx="${rad - pad}"/></clipPath>
    <image x="${pad}" y="${pad}" width="${dispW}" height="${dispH}" href="${p.uri}" preserveAspectRatio="none" clip-path="url(#${id})"/>
  </g>`;
}

/* ---------------------------------- frames --------------------------------- */

async function bannerSvg() {
  const W = 1440;
  const H = 360;
  const PADX = 22;
  let pillsX = 292;
  let pills = '';
  for (const p of ['Импорт от Shkolo PDF', 'Домашни с файлове', 'Работи като приложение']) {
    const m = await measureText(p, 19, 500);
    const w = Math.round(m.width + PADX * 2);
    pills += rrect({ x: pillsX, y: 254, w, h: 46, r: 23, fill: WHITE, opacity: 0.16 });
    pills += text(pillsX + PADX - m.left, 285, 19, p, { fill: WHITE, weight: 500, opacity: 0.95 });
    pillsX += w + 14;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${rrect({ x: 0, y: 0, w: W, h: H, fill: GREEN })}
  ${grid(W, H, '#ffffff', 0.05)}
  ${rrect({ x: 0, y: 0, w: 18, h: H, fill: LIME })}
  <image x="92" y="112" width="150" height="150" href="${dataUri(path.join(ICONS, 'icon-192.png'))}"/>
  ${text(292, 176, 100, 'Домашно', { weight: 700, fill: WHITE, spacing: -3 })}
  ${text(294, 234, 32, 'Разписание и домашни за класа', { fill: WHITE, opacity: 0.92 })}
  ${pills}
</svg>`;
}

async function socialSvg() {
  const W = 1440;
  const H = 720;
  const bullets = [
    'Импортирай разписанието от Shkolo PDF',
    '„Днес“ следва часовника — преди, сега, следващ',
    'Домашни с текст, снимки, PDF и презентации',
    'Класове с код за покана и права за публикуване',
  ];
  let els = '';
  bullets.forEach((b, i) => {
    const y = 366 + i * 56;
    els += rrect({ x: 84, y: y - 26, w: 36, h: 36, r: 11, fill: LIME });
    els += text(102, y, 19, String(i + 1), { weight: 700, fill: INK, anchor: 'middle' });
    els += text(136, y, 22, b, { fill: WHITE, opacity: 0.96 });
  });

  const today = await prepareShot('today.jpg', 300);
  const week = await prepareShot('week.jpg', 300);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${rrect({ x: 0, y: 0, w: W, h: H, fill: GREEN })}
  ${grid(W, H, '#ffffff', 0.05)}
  ${text(84, 250, 84, 'Домашно', { weight: 700, fill: WHITE, spacing: -3 })}
  ${text(86, 306, 30, 'Разписание и домашни за класа', { fill: WHITE, opacity: 0.92 })}
  ${els}
  ${phone('pB', 1128, 78, 300, week, 4)}
  ${phone('pA', 880, 44, 300, today, 0)}
</svg>`;
}

async function promoSvg() {
  const W = 1440;
  const H = 810;
  const feats = [
    ['Умна дата на предаване', 'Показва дните, в които имате този предмет — и кой час.'],
    ['Всичко на едно място', 'Снимки, PDF, презентации и документи с преглед в приложението.'],
    ['Светла и тъмна тема', 'Български и английски, инсталира се на телефона.'],
  ];
  let els = '';
  feats.forEach(([title, sub], i) => {
    const y = 520 + i * 84;
    els += rrect({ x: 84, y: y - 34, w: 44, h: 44, r: 13, fill: GREEN });
    els += text(106, y - 4, 19, String(i + 1), { weight: 700, fill: WHITE, anchor: 'middle' });
    els += text(146, y - 8, 21, title, { weight: 700, fill: INK });
    els += text(146, y + 20, 16, sub, { fill: MUTED });
  });

  const homework = await prepareShot('homework.jpg', 292);
  const week = await prepareShot('week.jpg', 300);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${rrect({ x: 0, y: 0, w: W, h: H, fill: BG })}
  ${rrect({ x: 84, y: 96, w: 232, h: 40, r: 20, fill: WHITE })}
  ${text(112, 122, 16, 'Разписание + домашни', { weight: 700, fill: GREEN })}
  ${text(84, 230, 62, 'Целият клас знае', { weight: 700, fill: INK, spacing: -2 })}
  ${text(84, 302, 62, 'какво е за утре', { weight: 700, fill: GREEN, spacing: -2 })}
  ${text(86, 356, 22, 'Качете PDF-а от Shkolo, прегледайте разписанието и всеки', { fill: MUTED })}
  ${text(86, 388, 22, 'може да добавя домашно с файлове — за точната дата и час.', { fill: MUTED })}
  ${els}
  ${phone('pL', 858, 96, 292, homework, -4)}
  ${phone('pR', 1070, 54, 300, week, 0)}
</svg>`;
}

function lockupSvg() {
  const W = 720;
  const H = 180;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${rrect({ x: 0, y: 0, w: W, h: H, fill: WHITE })}
  <image x="40" y="46" width="88" height="88" href="${dataUri(path.join(ICONS, 'icon-512.png'))}"/>
  ${text(152, 104, 62, 'Домашно', { weight: 700, fill: INK, spacing: -2 })}
  ${text(154, 134, 19, 'Разписание и домашни за класа', { fill: MUTED })}
</svg>`;
}

/* ---------------------------------- render --------------------------------- */

const jobs = [
  { name: 'banner', svg: await bannerSvg() },
  { name: 'social-preview', svg: await socialSvg() },
  { name: 'promo', svg: await promoSvg() },
  { name: 'logo-lockup', svg: lockupSvg() },
];

const docs = path.join(ROOT, 'docs');
const publicBranding = path.join(WEB, 'public', 'branding');
fs.mkdirSync(docs, { recursive: true });
fs.mkdirSync(publicBranding, { recursive: true });

for (const j of jobs) {
  const m = /width="(\d+)" height="(\d+)"/.exec(j.svg);
  const w = Math.round(Number(m[1]) * SCALE);
  const h = Math.round(Number(m[2]) * SCALE);
  const buf = await sharp(Buffer.from(j.svg), { density: 72 * SCALE })
    .resize(w, h)
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(docs, `${j.name}.png`), buf);
  fs.writeFileSync(path.join(publicBranding, `${j.name}.png`), buf);
  console.log(`${j.name}.png  ${w}x${h}  ${(buf.length / 1024).toFixed(0)} KB`);
}
