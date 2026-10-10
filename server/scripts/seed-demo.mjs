// Seed a demo class for local development: a timetable (incl. lessons around
// "now"), homework with real attachments, and a second member.
//
//   node scripts/seed-demo.mjs
//
// Log in with the developer sign-in form using  demo@domashno.local
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { sample7a } from '../src/sample7a.js';
import { newInviteCode } from '../src/util.js';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(SERVER_DIR, 'data');
const UPLOADS = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

const OWNER_EMAIL = 'demo@domashno.local';
const PEER_EMAIL = 'preslav@domashno.local';
const COLORS = ['#1E7A4C', '#2F6FB0', '#B1539A', '#C2703A', '#8A6D1F', '#4C6B8A', '#A63D57', '#3F8F8A', '#7A5AA8', '#6A8E3A'];

const db = new Database(path.join(DATA_DIR, 'domashno.db'));
db.pragma('foreign_keys = ON');

const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const at = (min) => new Date(Date.now() + min * 60_000);

/* --------------------------------- users ---------------------------------- */

function upsertUser(email, name) {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) {
    db.prepare('UPDATE users SET name = ?, email_verified = 1 WHERE id = ?').run(name, existing.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
  }
  const id = uid();
  db.prepare('INSERT INTO users (id,name,email,email_verified,avatar_url,created_at) VALUES (?,?,?,1,NULL,?)')
    .run(id, name, email, nowIso());
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

const owner = upsertUser(OWNER_EMAIL, 'Георги Гърдев');
const peer = upsertUser(PEER_EMAIL, 'Преслав Колев');

// fresh demo class each run
for (const c of db.prepare('SELECT id FROM classes WHERE owner_id = ?').all(owner.id)) {
  db.prepare('DELETE FROM classes WHERE id = ?').run(c.id);
}

const classId = uid();
let invite = newInviteCode();
while (db.prepare('SELECT 1 FROM classes WHERE invite_code = ?').get(invite)) invite = newInviteCode();
db.prepare(`INSERT INTO classes (id,name,owner_id,invite_code,post_policy,source_url,created_at)
  VALUES (?,?,?,?,?,?,?)`)
  .run(classId, '7 А', owner.id, invite, 'everyone', 'https://app.shkolo.bg/diary#tab_schedule', nowIso());
db.prepare('INSERT INTO members (class_id,user_id,role,created_at) VALUES (?,?,?,?)').run(classId, owner.id, 'owner', nowIso());
db.prepare('INSERT INTO members (class_id,user_id,role,created_at) VALUES (?,?,?,?)').run(classId, peer.id, 'member', nowIso());

/* -------------------------------- timetable ------------------------------- */

const today = new Date();
const todayDay = ((today.getDay() + 6) % 7) + 1; // 1=Mon … 7=Sun

// three lessons around the current time so "NOW" lights up right away
const live = [
  { period: 1, subject: 'Мат', teacher: 'Венета Т. Кюркова', room: 'к-т 23 (Етаж 3)', start: hhmm(at(-70)), end: hhmm(at(-25)) },
  { period: 2, subject: 'БЕЛ', teacher: 'Веселин П. Кюмюрджиев', room: 'к-т 13 (Етаж 1)', start: hhmm(at(-20)), end: hhmm(at(+25)) },
  { period: 3, subject: 'Физика и астр', teacher: 'Кети П. Маринова', room: 'к-т 22 (Етаж 3)', start: hhmm(at(+35)), end: hhmm(at(+80)) },
];

const allSlots = [
  ...sample7a.slots.map((s) => ({ day: s.day, period: s.period, subject: s.subject, teacher: s.teacher, room: s.room, start: s.start, end: s.end })),
  ...live.map((s) => ({ day: todayDay, ...s })),
];

const subjectIds = new Map();
const subjectNames = [...new Set(allSlots.map((s) => s.subject))];
subjectNames.forEach((name, i) => {
  const sid = uid();
  const teacher = allSlots.find((s) => s.subject === name)?.teacher ?? null;
  db.prepare('INSERT INTO subjects (id,class_id,name,color,teacher,sort,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(sid, classId, name, COLORS[i % COLORS.length], teacher, i, nowIso());
  subjectIds.set(name, sid);
});

const insSlot = db.prepare(`INSERT INTO slots (id,class_id,day,period,subject_id,label,teacher,room,start_time,end_time,created_at)
  VALUES (?,?,?,?,?,NULL,?,?,?,?,?)`);
for (const s of allSlots) {
  insSlot.run(uid(), classId, s.day, s.period, subjectIds.get(s.subject), s.teacher, s.room, s.start || null, s.end || null, nowIso());
}

/* --------------------------------- images --------------------------------- */

async function png(name, width, height, svg) {
  const stored = `${uid()}.png`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(UPLOADS, stored));
  return { stored, original: name, mime: 'image/png', size: fs.statSync(path.join(UPLOADS, stored)).size };
}

const worksheet = await png('zadachi.png', 1000, 1300, `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1300">
  <rect width="1000" height="1300" fill="#fdfcf7"/>
  <g stroke="#dfe6df" stroke-width="1">
    ${Array.from({ length: 26 }, (_, i) => `<line x1="0" y1="${50 * i + 100}" x2="1000" y2="${50 * i + 100}"/>`).join('')}
  </g>
  <text x="60" y="90" font-family="Arial, sans-serif" font-size="46" font-weight="bold" fill="#1e7a4c">Математика — задачи</text>
  <text x="60" y="200" font-family="Arial, sans-serif" font-size="34" fill="#20302a">1. 3x + 7 = 22</text>
  <text x="60" y="280" font-family="Arial, sans-serif" font-size="34" fill="#20302a">2. 5(x - 2) = 3x + 8</text>
  <text x="60" y="360" font-family="Arial, sans-serif" font-size="34" fill="#20302a">3. 2x² - 8 = 0</text>
  <text x="60" y="470" font-family="Arial, sans-serif" font-size="30" fill="#5c6e63">Намери x и запиши решението.</text>
  <g fill="none" stroke="#c7e86b" stroke-width="14" stroke-linecap="round">
    <path d="M80 640 L140 700 L250 560"/>
  </g>
</svg>`);

const board = await png('daska.png', 1200, 800, `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <rect width="1200" height="800" fill="#20302a"/>
  <text x="70" y="120" font-family="Arial, sans-serif" font-size="52" fill="#eaf3ec">Часовникът тиктака</text>
  <g stroke="#eaf3ec" stroke-width="10" stroke-linecap="round">
    <line x1="70" y1="220" x2="620" y2="220"/>
    <line x1="70" y1="290" x2="480" y2="290"/>
    <line x1="70" y1="360" x2="560" y2="360"/>
  </g>
  <circle cx="900" cy="330" r="150" fill="none" stroke="#c7e86b" stroke-width="14"/>
  <line x1="900" y1="330" x2="900" y2="230" stroke="#c7e86b" stroke-width="12" stroke-linecap="round"/>
  <line x1="900" y1="330" x2="975" y2="370" stroke="#c7e86b" stroke-width="12" stroke-linecap="round"/>
  <text x="70" y="620" font-family="Arial, sans-serif" font-size="40" fill="#9fbfa9">Снимка от дъската</text>
</svg>`);

const diagram = await png('shema.png', 1100, 750, `
<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="750">
  <rect width="1100" height="750" fill="#f4f7f8"/>
  <rect x="120" y="300" width="240" height="150" rx="18" fill="#2f6fb0"/>
  <rect x="740" y="300" width="240" height="150" rx="18" fill="#1e7a4c"/>
  <line x1="360" y1="375" x2="740" y2="375" stroke="#20302a" stroke-width="10"/>
  <path d="M700 340 L745 375 L700 410" fill="none" stroke="#20302a" stroke-width="10" stroke-linecap="round"/>
  <text x="150" y="390" font-family="Arial, sans-serif" font-size="34" fill="#ffffff">Слънчева</text>
  <text x="770" y="390" font-family="Arial, sans-serif" font-size="34" fill="#ffffff">Глюкоза</text>
  <text x="120" y="120" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="#20302a">Фотосинтеза</text>
</svg>`);

/* ------------------------------- pdf (minimal) ----------------------------- */

function makePdf(title, lines) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = [
    'BT /F1 20 Tf 60 790 Td (' + esc(title) + ') Tj ET',
    ...lines.map((l, i) => `BT /F1 13 Tf 60 ${740 - i * 26} Td (${esc(l)}) Tj ET`),
  ].join('\n');

  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const pdfStored = `${uid()}.pdf`;
fs.writeFileSync(path.join(UPLOADS, pdfStored), makePdf('Bulgarian Language - homework', [
  'Essay: My summer (150 words).',
  '',
  'Use the past tense.',
  'Write it by hand in the notebook, then upload a photo.',
]));
const notes = { stored: pdfStored, original: 'ese-bul.pdf', mime: 'application/pdf', size: fs.statSync(path.join(UPLOADS, pdfStored)).size };

/* -------------------------------- homework -------------------------------- */

const insHw = db.prepare(`INSERT INTO homework (id,class_id,subject_id,created_by,title,body,due_date,due_period,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?)`);
const insAtt = db.prepare(`INSERT INTO attachments (id,homework_id,stored_name,original_name,mime,size,created_at)
  VALUES (?,?,?,?,?,?,?)`);

function addHomework({ subject, title, body, dueDate, duePeriod = null, by = owner.id, files = [] }) {
  const hwId = uid();
  insHw.run(hwId, classId, subjectIds.get(subject) ?? null, by, title, body, dueDate, duePeriod, nowIso(), nowIso());
  for (const f of files) insAtt.run(uid(), hwId, f.stored, f.original, f.mime, f.size, nowIso());
  return hwId;
}

const todayIso = iso(today);
const liveMath = live.find((s) => s.subject === 'Мат');

addHomework({
  subject: 'Мат',
  title: 'Задачи 5–8, стр. 42',
  body: 'Реши задачите в тетрадката и снимай решението.',
  dueDate: todayIso,
  duePeriod: liveMath?.period ?? null,
  files: [worksheet, notes],
});
addHomework({
  subject: 'БЕЛ',
  title: 'Есе: „Моето лято“ (150 думи)',
  body: 'Напиши есето в тетрадката. Използвай минало време.',
  dueDate: todayIso,
  files: [board],
});
addHomework({
  subject: 'Физика и астр',
  title: 'Прочети §12 и направи опита',
  body: 'Запиши наблюденията си в таблица.',
  dueDate: iso(addDays(today, 1)),
});
addHomework({
  subject: 'Биол',
  title: 'Презентация: Клетката',
  body: 'Направи кратка презентация (5–7 слайда) върху строежа на клетката.',
  dueDate: iso(addDays(today, 3)),
  files: [diagram],
});
addHomework({
  subject: 'История',
  title: 'Отговори на въпроси 1–5',
  body: 'Стр. 88, въпросите накрая на урока.',
  dueDate: iso(addDays(today, -1)),
  by: peer.id,
});

/* ---------------------------------- report -------------------------------- */

console.log(`\n  Демо данни са готови.`);
console.log(`  Клас:       7 А   (invite ${invite})`);
console.log(`  Дни:        ${sample7a.slots.length + live.length} часа в разписанието`);
console.log(`  Днес:       ${todayDay} — ${live.map((l) => `${l.subject} ${l.start}`).join(', ')}`);
console.log(`  Домашни:    5 (две за днес, с прикачени файлове)`);
console.log(`  Членове:    Георги Гърдев (собственик), Преслав Колев\n`);
console.log(`  ВХОД: на /login натисни „Developer sign-in“ и въведи:`);
console.log(`        име:    Георги Гърдев`);
console.log(`        имейл:  ${OWNER_EMAIL}\n`);
