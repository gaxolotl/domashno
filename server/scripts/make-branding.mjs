// Branding image generator — renders the promo art as vector SVG and rasterises it
// with sharp, so text stays perfectly crisp (no screenshot/JPEG round-trip).
//
//   node scripts/make-branding.mjs
//
// Outputs docs/*.png (for the README) and web/public/branding/*.png (served, og:image).
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
const LINE = '#D5DED4';
const WHITE = '#FFFFFF';

const FONT = "'Segoe UI', 'Segoe UI Semibold', Arial, Helvetica, sans-serif";

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const dataUri = (p) => `data:image/png;base64,${b64(p)}`;
const shotUri = (name) => `data:image/jpeg;base64,${b64(path.join(SHOTS, name))}`;

const rrect = ({ x, y, w, h, r = 0, fill, opacity = 1 }) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;

const text = (x, y, size, content, { weight = 400, fill = INK, spacing = 0, anchor = 'start', opacity = 1 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}"` +
  `${spacing ? ` letter-spacing="${spacing}"` : ''}${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}` +
  `${opacity !== 1 ? ` opacity="${opacity}"` : ''}>${esc(content)}</text>`;

/** grid of faint lines, like graph paper / a chalkboard */
const grid = (w, h, color, opacity = 0.06) => `
  <defs>
    <pattern id="pgrid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="${color}" stroke-width="1" stroke-opacity="${opacity}"/>
    </pattern>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#pgrid)"/>`;

/** a phone mock-up with an embedded screenshot */
const phone = (id, x, y, w, screen, rotate = 0) => {
  const pad = Math.round(w * 0.03);
  const inner = w - pad * 2;
  const h = Math.round((screen.h / screen.w) * inner);
  const bezel = h + pad * 2;
  const rad = Math.round(w * 0.115);
  const img = screen.uri;
  return `
  <g transform="translate(${x} ${y})${rotate ? ` rotate(${rotate} ${w / 2} ${bezel / 2})` : ''}">
    <rect x="4" y="10" width="${w}" height="${bezel}" rx="${rad}" fill="#000000" opacity="0.22"/>
    <rect x="0" y="0" width="${w}" height="${bezel}" rx="${rad}" fill="#0d1512"/>
    <clipPath id="${id}"><rect x="${pad}" y="${pad}" width="${inner}" height="${h}" rx="${rad - pad}"/></clipPath>
    <image x="${pad}" y="${pad}" width="${inner}" height="${h}" href="${img}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>
  </g>`;
};

const shot = (name) => ({ uri: shotUri(name), w: 390, h: 844 });

/* ------------------------------------------------------------------ banner */

function bannerSvg() {
  const W = 1440;
  const H = 360;
  const pills = ['Импорт от Shkolo PDF', 'Домашни с файлове', 'Работи като приложение'];
  let pillsX = 292;
  const pillEls = pills.map((p) => {
    const w = 36 + p.length * 9.6;
    const el = rrect({ x: pillsX, y: 254, w: Math.round(w), h: 46, r: 23, fill: WHITE, opacity: 0.16 })
      + text(pillsX + 18, 284, 19, p, { fill: WHITE, weight: 500, opacity: 0.95 });
    pillsX += Math.round(w) + 14;
    return el;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${rrect({ x: 0, y: 0, w: W, h: H, fill: GREEN })}
  ${grid(W, H, '#ffffff', 0.05)}
  ${rrect({ x: 0, y: 0, w: 18, h: H, fill: LIME })}
  <image x="92" y="112" width="150" height="150" href="${dataUri(path.join(ICONS, 'icon-192.png'))}"/>
  ${text(292, 176, 100, 'Домашно', { weight: 700, fill: WHITE, spacing: -3 })}
  ${text(294, 234, 32, 'Разписание и домашни за класа', { fill: WHITE, opacity: 0.92 })}
  ${pillEls}
</svg>`;
}

/* ------------------------------------------------------------------ social */

function socialSvg() {
  const W = 1440;
  const H = 720;
  const bullets = [
    'Импортирай разписанието от Shkolo PDF',
    '„Днес“ следва часовника — преди, сега, следващ',
    'Домашни с текст, снимки, PDF и презентации',
    'Класове с код за покана и права за публикуване',
  ];
  const bulletEls = bullets.map((b, i) => {
    const y = 366 + i * 56;
    return rrect({ x: 84, y: y - 26, w: 36, h: 36, r: 11, fill: LIME })
      + text(102, y, 19, String(i + 1), { weight: 700, fill: INK, anchor: 'middle' })
      + text(136, y, 22, b, { fill: WHITE, opacity: 0.96 });
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${rrect({ x: 0, y: 0, w: W, h: H, fill: GREEN })}
  ${grid(W, H, '#ffffff', 0.05)}
  ${text(84, 250, 84, 'Домашно', { weight: 700, fill: WHITE, spacing: -3 })}
  ${text(86, 306, 30, 'Разписание и домашни за класа', { fill: WHITE, opacity: 0.92 })}
  ${bulletEls}
  ${phone('pB', 1128, 78, 300, shot('week.jpg'), 4)}
  ${phone('pA', 880, 44, 300, shot('today.jpg'), 0)}
</svg>`;
}

/* ------------------------------------------------------------------- promo */

function promoSvg() {
  const W = 1440;
  const H = 810;
  const feats = [
    ['Умна дата на предаване', 'Показва дните, в които имате този предмет — и кой час.'],
    ['Всичко на едно място', 'Снимки, PDF, презентации и документи с преглед в приложението.'],
    ['Светла и тъмна тема', 'Български и английски, инсталира се на телефона.'],
  ];
  const featEls = feats.map(([title, sub], i) => {
    const y = 520 + i * 84;
    return rrect({ x: 84, y: y - 34, w: 44, h: 44, r: 13, fill: GREEN })
      + text(106, y - 4, 19, String(i + 1), { weight: 700, fill: WHITE, anchor: 'middle' })
      + text(146, y - 8, 21, title, { weight: 700, fill: INK })
      + text(146, y + 20, 16, sub, { fill: MUTED });
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${rrect({ x: 0, y: 0, w: W, h: H, fill: BG })}
  ${rrect({ x: 84, y: 96, w: 232, h: 40, r: 20, fill: WHITE })}
  ${rrect({ x: 84, y: 96, w: 232, h: 40, r: 20, fill: 'none' })}
  ${text(112, 122, 16, 'Разписание + домашни', { weight: 700, fill: GREEN })}
  ${text(84, 230, 62, 'Целият клас знае', { weight: 700, fill: INK, spacing: -2 })}
  ${text(84, 302, 62, 'какво е за утре', { weight: 700, fill: GREEN, spacing: -2 })}
  ${text(86, 356, 22, 'Качете PDF-а от Shkolo, прегледайте разписанието и всеки', { fill: MUTED })}
  ${text(86, 388, 22, 'може да добавя домашно с файлове — за точната дата и час.', { fill: MUTED })}
  ${featEls}
  ${phone('pL', 858, 96, 292, shot('homework.jpg'), -4)}
  ${phone('pR', 1070, 54, 300, shot('week.jpg'), 0)}
</svg>`;
}

/* ------------------------------------------------------------------ lockup */

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

/* ------------------------------------------------------------------ render */

const jobs = [
  { name: 'banner', svg: bannerSvg(), scale: 2 },
  { name: 'social-preview', svg: socialSvg(), scale: 2 },
  { name: 'promo', svg: promoSvg(), scale: 2 },
  { name: 'logo-lockup', svg: lockupSvg(), scale: 2 },
];

const docs = path.join(ROOT, 'docs');
const publicBranding = path.join(WEB, 'public', 'branding');
fs.mkdirSync(docs, { recursive: true });
fs.mkdirSync(publicBranding, { recursive: true });

for (const j of jobs) {
  const meta = /width="(\d+)" height="(\d+)"/.exec(j.svg);
  const w = Number(meta[1]) * j.scale;
  const h = Number(meta[2]) * j.scale;
  const buf = await sharp(Buffer.from(j.svg), { density: 72 * j.scale })
    .resize(w, h)
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(docs, `${j.name}.png`), buf);
  fs.writeFileSync(path.join(publicBranding, `${j.name}.png`), buf);
  console.log(`${j.name}.png  ${w}x${h}  ${(buf.length / 1024).toFixed(0)} KB`);
}
