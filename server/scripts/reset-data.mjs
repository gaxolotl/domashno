// Wipe all application data (database + uploads). Keeps .env untouched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

let removed = 0;
for (const f of ['domashno.db', 'domashno.db-wal', 'domashno.db-shm']) {
  const p = path.join(dataDir, f);
  if (fs.existsSync(p)) {
    fs.rmSync(p);
    console.log('removed', f);
    removed++;
  }
}
const uploads = path.join(dataDir, 'uploads');
if (fs.existsSync(uploads)) {
  fs.rmSync(uploads, { recursive: true, force: true });
  console.log('removed uploads/');
  removed++;
}
fs.mkdirSync(uploads, { recursive: true });
console.log(removed ? '\nData reset. A fresh, empty database will be created on next start.' : '\nNothing to reset.');
