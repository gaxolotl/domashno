// Regression checks for the Multer 2/body-parser security updates.
// Uses an isolated temporary database and a child server, not real user data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import net from 'node:net';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpRoot = path.join(os.tmpdir(), 'opencode');
fs.mkdirSync(tmpRoot, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(tmpRoot, 'domashno-upload-security-'));
const port = await new Promise((resolve) => {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port;
    probe.close(() => resolve(value));
  });
});
const base = `http://localhost:${port}`;
const child = spawn(process.execPath, ['src/index.js'], {
  cwd: serverDir,
  env: {
    ...process.env, DATA_DIR: dataDir, PORT: String(port), APP_URL: base, SERVER_URL: base,
    NODE_ENV: 'development', ENABLE_DEV_LOGIN: '1', ADMIN_EMAIL: 'admin@upload.local', ADMIN_EMAILS: '',
    SESSION_SECRET: 'upload-tests-only', TURNSTILE_SITE_KEY: '', TURNSTILE_SECRET_KEY: '',
    RESEND_API_KEY: '', SMTP_HOST: '', MAX_CDN_MB: '1', MAX_UPLOAD_MB: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let errors = '';
child.stderr.on('data', (buf) => { errors += buf.toString(); });
let checks = 0;
function check(actual, expected, description) {
  assert.deepEqual(actual, expected, description);
  console.log(`ok: ${description}`);
  checks += 1;
}

const jar = new Map();
async function request(url, method = 'GET', body) {
  const multipart = body instanceof FormData;
  const res = await fetch(base + url, {
    method,
    headers: {
      Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      ...(method !== 'GET' ? { 'X-CSRF-Token': jar.get('domashno_csrf') || '' } : {}),
      ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
  });
  for (const cookie of res.headers.getSetCookie()) {
    const pair = cookie.split(';')[0];
    const i = pair.indexOf('=');
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return res;
}
const form = (name, content, type = 'application/octet-stream', field = 'files') => {
  const fd = new FormData();
  fd.append(field, new Blob([content], { type }), name);
  return fd;
};

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Startup timeout: ${errors}`)), 15000);
    child.on('error', reject);
    child.on('exit', () => reject(new Error(`Server exited: ${errors}`)));
    child.stdout.on('data', (buf) => {
      if (buf.toString().includes('server listening')) { clearTimeout(timer); resolve(); }
    });
  });
  await request('/api/health');
  check((await request('/api/auth/dev', 'POST', { name: 'Upload Test', email: 'admin@upload.local', terms: true })).status, 200, 'login still works');
  const cls = (await (await request('/api/classes', 'POST', { name: 'Upload fixtures' })).json()).class;
  const hw = (await (await request(`/api/classes/${cls.id}/homework`, 'POST', {
    subject_id: null, title: 'Upload fixture', body: '', due_date: '2026-12-01',
  })).json()).homework;

  let res = await request(`/api/homework/${hw.id}/attachments`, 'POST', form('notes.txt', 'homework notes', 'text/plain'));
  check(res.status, 201, 'homework disk upload accepted');
  const att = (await res.json()).attachments[0];
  check(await (await request(att.url)).text(), 'homework notes', 'attachment round trip is unchanged');
  res = await request(`/api/homework/${hw.id}/attachments`, 'POST', form('bad.exe', 'file', 'application/octet-stream'));
  check(res.status, 400, 'homework file-type restrictions still apply');
  res = await request(`/api/classes/${cls.id}/import/pdf`, 'POST', form('wrong.txt', 'not a PDF', 'text/plain', 'file'));
  check(res.status, 400, 'PDF-only memory upload validation still works');
  res = await request(`/api/classes/${cls.id}/import/pdf`, 'POST', form('broken.pdf', '%PDF-1.4\ninvalid PDF fixture', 'application/pdf', 'file'));
  check(res.status, 422, 'PDF buffer reaches the parser without crashing the server');

  res = await request('/api/admin/files', 'POST', form('arbitrary.bin', 'any file type'));
  check(res.status, 201, 'CDN arbitrary-file upload accepted');
  check(await (await request('/api/admin/files/raw?path=arbitrary.bin')).text(), 'any file type', 'CDN file round trip is unchanged');
  res = await request('/api/admin/files', 'POST', form('arbitrary.bin', 'second file'));
  check((await res.json()).uploaded[0].name, 'arbitrary (1).bin', 'CDN collisions still rename rather than overwrite');
  res = await request('/api/admin/files', 'POST', form('oversized.bin', new Uint8Array(2 * 1024 * 1024)));
  check(res.status, 413, 'CDN per-file size limit enforced');
  const listing = await (await request('/api/admin/files')).json();
  check(listing.entries.some((e) => e.name === 'oversized.bin'), false, 'oversized partial upload removed');
  res = await request('/api/admin/files', 'POST', form('index.html', '<script>throw 1</script>', 'text/html'));
  check(res.status, 201, 'CDN accepts HTML for storage');
  res = await request('/api/admin/files/raw?path=index.html');
  check(res.headers.get('content-disposition').startsWith('attachment'), true, 'HTML still forced to download');
  check(res.headers.get('x-content-type-options'), 'nosniff', 'uploaded content remains sniff-proof');
  const tooMany = new FormData();
  for (let i = 0; i < 31; i++) tooMany.append('files', new Blob(['x']), `file-${i}.bin`);
  check((await request('/api/admin/files', 'POST', tooMany)).status, 400, 'per-request file count limit enforced');

  // Regression for GHSA-27r3-jxmh-p828: trailing compressed bytes must not
  // crash the Node process while parsing a JSON body.
  const compressed = Buffer.concat([gzipSync(Buffer.from('{"name":"gzip"}')), Buffer.from('unexpected trailing bytes')]);
  const malformed = await fetch(base + '/api/classes', {
    method: 'POST',
    headers: {
      Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      'Content-Type': 'application/json', 'Content-Encoding': 'gzip',
      'X-CSRF-Token': jar.get('domashno_csrf'),
    },
    body: compressed,
  });
  check(malformed.status, 400, 'malformed compressed JSON rejected');
  check((await request('/api/health')).status, 200, 'server remains healthy after malformed upload/body');

  await request(`/api/attachments/${att.id}`, 'DELETE');
  check((await request(att.url)).status, 404, 'attachment deletion still works');
  console.log(`\nALL PASSED (${checks} upload/security checks).`);
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
}
