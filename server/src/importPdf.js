// Turn a Shkolo timetable PDF into an editable schedule draft.
//
// Shkolo exports a *text* PDF: the timetable lives in the text layer (split across
// several embedded fonts). We read it with pdf.js, rebuild the day-grid from word
// boxes, and parse each day block into { period, subject, teacher, room, start, end }.
// The result is only a draft; the user reviews and fixes it in the UI before saving.

const DAYS = [
  { day: 1, re: /^(понеделник|пон|monday|mon)(?![а-яa-z])/i },
  { day: 2, re: /^(вторник|вто|tuesday|tue)(?![а-яa-z])/i },
  { day: 3, re: /^(сряда|сря|срд|wednesday|wed)(?![а-яa-z])/i },
  { day: 4, re: /^(четвъртък|чет|thursday|thu)(?![а-яa-z])/i },
  { day: 5, re: /^(петък|пет|friday|fri)(?![а-яa-z])/i },
  { day: 6, re: /^(събота|съб|saturday|sat)(?![а-яa-z])/i },
  { day: 7, re: /^(неделя|нед|sunday|sun)(?![а-яa-z])/i },
];

const DATE_ONLY = /^[\/|#]?\s*\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\s*$/;
const PERIOD_RE = /^[^\wА-Яа-я]*\s*(\d{1,2})\s*[.)]\s*(\S.*)$/;
const NOISE = /shkolo\s*дневник|https?:\/\/|tab_schedule|^\s*\d{1,2}\s*\/\s*\d{1,2}\s*$|^\d{1,2}\/\d{1,2}\/\d{2,4},?\s*\d{1,2}:\d{2}/i;
const TIME_RE = /(\d{1,2}:\d{2})\s*[-–—~‒]\s*(\d{1,2}:\d{2})/;
const META_MARKER = /^(?:вд|vv|бб|66|bb|б6|6б|бe|be|oo)\s*/i;
const isMeta = (t) => TIME_RE.test(t) || META_MARKER.test(t) || /к\s*-?\s*т/i.test(t);

/* ------------------------------ pdf.js loading ----------------------------- */

let pdfjsPromise;
async function getPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
}

// Rebuild word boxes from pdf.js text items, normalising any page rotation to a
// common upright orientation so that rows can be grouped by y.
function textWords(items) {
  const clean = items.filter((it) => 'str' in it && it.str.trim());
  if (!clean.length) return { words: [], text: '' };
  let sumSin = 0;
  let sumCos = 0;
  for (const it of clean) {
    const [a, b] = it.transform;
    sumSin += Math.sin(Math.atan2(b, a));
    sumCos += Math.cos(Math.atan2(b, a));
  }
  const mean = Math.atan2(sumSin, sumCos);
  const cos = Math.cos(-mean);
  const sin = Math.sin(-mean);
  const words = clean.map((it) => {
    const x = it.transform[4];
    const y = it.transform[5];
    const px = x * cos - y * sin;
    const py = x * sin + y * cos;
    const w = Math.abs(it.width) || it.str.length * 4;
    const h = Math.abs(it.height) || 8;
    return { text: it.str, left: px, right: px + w, top: -py - h, bottom: -py + h, cx: px + w / 2, cy: -py };
  });
  return { words, text: clean.map((it) => it.str).join(' ') };
}

/* ------------------------- words -> visual lines --------------------------- */

function wordsToLines(words, pageWidth) {
  if (!words || !words.length) return [];
  const heights = words.map((w) => w.bottom - w.top).filter((h) => h > 0).sort((a, b) => a - b);
  const medH = heights[Math.floor(heights.length / 2)] || 10;

  const rows = [];
  for (const w of [...words].sort((a, b) => a.cy - b.cy || a.left - b.left)) {
    let row = null;
    for (let i = rows.length - 1; i >= 0 && i >= rows.length - 3; i--) {
      if (Math.abs(rows[i].cy - w.cy) <= medH * 0.65) { row = rows[i]; break; }
    }
    if (row) { row.words.push(w); row.cy = (row.cy * (row.words.length - 1) + w.cy) / row.words.length; }
    else rows.push({ cy: w.cy, words: [w] });
  }

  // A page-wide typical word gap is more stable than a per-row value.
  const allGaps = [];
  for (const row of rows) {
    const ws = row.words.slice().sort((a, b) => a.left - b.left);
    for (let i = 1; i < ws.length; i++) {
      const g = ws[i].left - ws[i - 1].right;
      if (g > 1) allGaps.push(g);
    }
  }
  allGaps.sort((a, b) => a - b);
  const medGap = allGaps.length ? allGaps[Math.floor(allGaps.length * 0.5)] : 10;
  const minGap = Math.max(pageWidth * 0.06, medGap * 5, 50);

  const lines = [];
  for (const row of rows) {
    const ws = row.words.slice().sort((a, b) => a.left - b.left);
    let seg = [ws[0]];
    const push = () => {
      if (!seg.length) return;
      const text = seg.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
      if (text) {
        lines.push({
          text,
          left: seg[0].left,
          right: seg[seg.length - 1].right,
          top: Math.min(...seg.map((s) => s.top)),
          bottom: Math.max(...seg.map((s) => s.bottom)),
          cx: (seg[0].left + seg[seg.length - 1].right) / 2,
          cy: row.cy,
        });
      }
    };
    for (let i = 1; i < ws.length; i++) {
      if (ws[i].left - ws[i - 1].right > minGap) { push(); seg = []; }
      seg.push(ws[i]);
    }
    push();
  }
  return lines;
}

/* --------------------------------- parsing --------------------------------- */

function normalizeText(t) {
  return t
    .replace(/[«»„“”]/g, '"')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\s+([.,;:!?)\]])/g, '$1')
    .replace(/([(\[])\s+/g, '$1')
    .replace(/\s*\/\s*/g, '/')
    .replace(/([а-яa-z])\s+-\s+([А-ЯA-Zа-яa-z])/g, '$1-$2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function matchDay(text) {
  const t = text.trim();
  for (const d of DAYS) if (d.re.test(t)) return d.day;
  return null;
}

function columnSplit(headers, pageWidth) {
  const cs = headers.map((h) => h.cx).sort((a, b) => a - b);
  if (cs.length < 2) return null;
  if (cs[cs.length - 1] - cs[0] < pageWidth * 0.25) return null;
  return (cs[0] + cs[cs.length - 1]) / 2;
}

function parseMeta(text, cur) {
  let rest = text;
  const tm = rest.match(TIME_RE);
  if (tm) {
    cur.start = tm[1];
    cur.end = tm[2];
    rest = rest.slice(0, tm.index) + ' ' + rest.slice(tm.index + tm[0].length);
  }
  rest = rest.replace(META_MARKER, '');
  const km = rest.match(/к\s*-?\s*т(?:и)?\.?\s*(.*)$/i);
  if (km) {
    cur.room = normalizeText(`к-т ${km[1]}`).replace(/[⌀ØøΦφΘθ©®|]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    rest = rest.slice(0, km.index);
  }
  const teacher = rest
    .replace(/\((?:[Ee]rax|Етаж|етаж|этаж)\s*\d\)/gi, ' ')
    .replace(/[⌀ØøΦφΘθ©®|•]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[.,;:]+$/, '');
  if (teacher && teacher.length > 1) cur.teacher = normalizeText(`${cur.teacher || ''} ${teacher}`);
  return cur;
}

function cleanSubject(s) {
  let out = s.trim();
  const m = out.match(/^(\S{1,3})\s+(.*)$/);
  if (m) {
    const tok = m[1];
    if (/\d/.test(tok) || (tok.length <= 2 && /^[A-Za-z]+$/.test(tok))) out = m[2];
  }
  return normalizeText(out.replace(/^[^\wА-Яа-я(]+/, '')).replace(/\s*\(\s*[.·…]+\s*\)\s*$/, '').trim();
}

function parsePages(pages) {
  const collected = [];
  let lastDay = null;
  let seq = 0;

  for (const page of pages) {
    const lines = (page.lines || []).filter((l) => l.text && l.text.trim() && !NOISE.test(l.text));
    if (!lines.length) continue;
    const pageWidth = Math.max(...lines.map((l) => l.right), 1);

    const headers = lines
      .filter((l) => matchDay(l.text) && !DATE_ONLY.test(l.text) && l.text.trim().length <= 40)
      .map((l) => ({ day: matchDay(l.text), cx: l.cx, top: l.top }));
    const split = columnSplit(headers, pageWidth);
    const columnOf = (l) => (split == null ? 0 : l.cx < split ? 0 : 1);
    const content = lines.filter((l) => !(matchDay(l.text) && l.text.trim().length <= 40) && !DATE_ONLY.test(l.text));

    for (const line of content.sort((a, b) => a.top - b.top || a.left - b.left)) {
      let day = null;
      if (headers.length) {
        const col = columnOf(line);
        const above = headers.filter((h) => columnOf(h) === col && h.top <= line.top + 6).sort((a, b) => a.top - b.top);
        day = above.length ? above[above.length - 1].day : lastDay;
      } else {
        day = lastDay;
      }
      if (day) collected.push({ day, seq: seq++, line });
    }
    if (headers.length) lastDay = headers.slice().sort((a, b) => a.top - b.top || a.cx - b.cx).at(-1).day;
  }

  const byDay = new Map();
  for (const item of collected) {
    if (!byDay.has(item.day)) byDay.set(item.day, []);
    byDay.get(item.day).push(item);
  }

  const slots = [];
  for (const [day, items] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    items.sort((a, b) => a.seq - b.seq);
    slots.push(...parseBlock(day, items.map((i) => i.line)));
  }
  return slots;
}

// Within one day block: unnumbered subject lines (OCR/typo) still start a new
// period, and a missing leading number is inferred from the start time.
function parseBlock(day, lines) {
  const entries = [];
  let cur = null;
  for (const line of lines) {
    const text = normalizeText(line.text);
    if (!text) continue;
    if (isMeta(text)) { if (cur) parseMeta(text, cur); continue; }
    const pm = text.match(PERIOD_RE);
    const period = pm ? Number(pm[1]) : null;
    const subject = cleanSubject(pm ? pm[2] : text);
    if (!subject || subject.length < 2 || !/[А-Яа-яA-Za-z]/.test(subject)) continue;
    cur = { period, subject, teacher: '', room: '', start: null, end: null };
    entries.push(cur);
  }
  const starts = entries.map((e) => e.start).filter(Boolean).sort();
  const earliest = starts[0];
  const base = entries.length && entries[0].period == null && earliest && earliest < '13:00' ? 0 : 1;
  let next = base;
  return entries.map((e) => {
    const period = e.period != null ? e.period : next;
    next = period + 1;
    return {
      day,
      period,
      subject: e.subject,
      teacher: e.teacher || '',
      room: e.room || '',
      start: e.start || '',
      end: e.end || '',
    };
  });
}

function guessClassName(pages) {
  for (const page of pages) {
    for (const l of page.lines) {
      const m = l.text.match(/(\d{1,2})\s?[-–]?\s?([А-ЯA-Z])(?![А-Яа-яA-Za-z])/);
      if (m && /клас/i.test(l.text)) return `${m[1]}${m[2]}`;
    }
  }
  for (const page of pages) {
    for (const l of page.lines) {
      const m = l.text.match(/(\d{1,2})\s?([А-ЯA-Z])(?![А-Яа-яA-Za-z])/);
      if (m && l.text.length < 160) return `${m[1]}${m[2]}`;
    }
  }
  return '';
}

function findSourceUrl(pages) {
  for (const page of pages) {
    for (const l of page.lines) {
      const m = l.text.match(/https?:\/\/[^\s]*shkolo\.bg[^\s]*/i);
      if (m) return m[0];
    }
  }
  return null;
}

/* --------------------------------- entry ----------------------------------- */

export async function parseShkoloPdf(buffer) {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const pages = [];
  let hasText = false;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const { words } = textWords(content.items);
    if (words.length > 12) hasText = true;
    const pageWidth = words.length ? Math.max(...words.map((w) => w.right)) : 1;
    pages.push({ lines: wordsToLines(words, pageWidth) });
  }

  if (!hasText) {
    throw new Error(
      'This PDF has no selectable text (it looks like a scan). Re-export it from Shkolo, '
      + 'or print the page to PDF with "Save as PDF" so the text stays selectable.',
    );
  }

  const slots = parsePages(pages);
  if (!slots.length) {
    throw new Error('Could not find a timetable in this PDF — you can add the schedule by hand instead');
  }
  return {
    name: guessClassName(pages),
    sourceUrl: findSourceUrl(pages),
    slots,
    source: 'text',
  };
}

export const __debug = { textWords, wordsToLines, parsePages };
