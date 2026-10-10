// Strip invisible/Private-Use-Area characters (Shkolo icon-font glyphs) from data
// that was imported before the sanitiser existed, and merge the duplicate subjects
// that result from it.
//
//   node scripts/clean-text.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { sanitizeText } from '../src/util.js';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(SERVER_DIR, 'data');

const db = new Database(path.join(DATA_DIR, 'domashno.db'));
db.pragma('foreign_keys = ON');

let changed = 0;
const fix = (table, column) => {
  const rows = db.prepare(`SELECT rowid AS rid, ${column} AS v FROM ${table} WHERE ${column} IS NOT NULL`).all();
  const upd = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`);
  for (const r of rows) {
    const clean = sanitizeText(r.v);
    if (clean !== r.v) { upd.run(clean, r.rid); changed++; }
  }
};

console.log('stripping invisible characters…');
for (const [t, c] of [
  ['users', 'name'],
  ['classes', 'name'],
  ['subjects', 'name'],
  ['subjects', 'teacher'],
  ['slots', 'label'],
  ['slots', 'teacher'],
  ['slots', 'room'],
  ['homework', 'title'],
  ['homework', 'body'],
]) fix(t, c);
console.log(`  ${changed} value(s) cleaned`);

console.log('merging duplicate subjects per class…');
const classes = db.prepare('SELECT id FROM classes').all();
let merged = 0;
const reassignSlots = db.prepare('UPDATE slots SET subject_id = ? WHERE subject_id = ?');
const reassignHw = db.prepare('UPDATE homework SET subject_id = ? WHERE subject_id = ?');
const copyPerm = db.prepare('INSERT OR IGNORE INTO subject_perms (class_id,subject_id,user_id) SELECT class_id, ?, user_id FROM subject_perms WHERE subject_id = ?');
const dropPerm = db.prepare('DELETE FROM subject_perms WHERE subject_id = ?');
const dropSubject = db.prepare('DELETE FROM subjects WHERE id = ?');

for (const { id: classId } of classes) {
  const subjects = db.prepare('SELECT * FROM subjects WHERE class_id = ? ORDER BY sort ASC, created_at ASC').all(classId);
  const groups = new Map();
  for (const s of subjects) {
    const key = (s.name || '').toLocaleLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const keep = list[0];
    for (const dupe of list.slice(1)) {
      reassignSlots.run(keep.id, dupe.id);
      reassignHw.run(keep.id, dupe.id);
      copyPerm.run(keep.id, dupe.id);
      dropPerm.run(dupe.id);
      dropSubject.run(dupe.id);
      merged++;
      console.log(`  "${keep.name}": merged 1 duplicate`);
    }
  }
}
console.log(`  ${merged} duplicate subject(s) merged`);
console.log('\nDone.');
