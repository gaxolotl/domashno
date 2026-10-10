import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderVerificationEmail } from '../src/email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, '..', '..', 'web', 'email-preview.html');

const bg = renderVerificationEmail({
  name: 'Георги',
  code: '428193',
  link: 'http://localhost:8787/api/auth/email/link?id=demo&t=demo',
  locale: 'bg',
  ttlMin: 10,
});
const en = renderVerificationEmail({
  name: 'Georgi',
  code: '428193',
  link: 'http://localhost:8787/api/auth/email/link?id=demo&t=demo',
  locale: 'en',
  ttlMin: 10,
});

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  `<!doctype html><meta charset="utf-8"><title>Email preview</title>
   <style>body{margin:0;font-family:system-ui;background:#fff}
   .lbl{padding:10px 16px;font:600 12px system-ui;color:#5c6e63;background:#f4f7f3;border-bottom:1px solid #e2e8e2}</style>
   <div class="lbl">SUBJECT: ${bg.subject}</div>${bg.html}
   <div class="lbl">SUBJECT (EN): ${en.subject}</div>${en.html}`,
);
console.log('wrote', out);
