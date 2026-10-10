// Dev helper: parse a PDF and print the resulting schedule draft.
// Usage: node scripts/test-import.mjs <path-to.pdf>
import { parseShkoloPdf } from '../src/importPdf.js';
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Pass a PDF path'); process.exit(1); }
const t0 = Date.now();
const draft = await parseShkoloPdf(fs.readFileSync(file));
console.log(`source=${draft.source} rotation=${draft.rotation ?? '-'} name="${draft.name}" slots=${draft.slots.length} (${Date.now() - t0}ms)`);
const byDay = {};
for (const s of draft.slots) (byDay[s.day] ??= []).push(s);
for (const day of Object.keys(byDay).sort()) {
  console.log(`\n--- day ${day} ---`);
  for (const s of byDay[day]) {
    console.log(`  ${String(s.period).padStart(2)} | ${s.start}-${s.end} | ${s.subject} | ${s.teacher} | ${s.room}`);
  }
}
process.exit(0);
