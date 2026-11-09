// Integration checks for admin-managed class membership.
// Starts a child server with its own temporary database; never touches server/data.
// Run: node scripts/test-admin-members.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = path.join(os.tmpdir(), 'opencode');
fs.mkdirSync(temporaryRoot, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(temporaryRoot, 'domashno-admin-members-'));
const port = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.on('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port;
    probe.close(() => resolve(value));
  });
});
const base = `http://localhost:${port}`;
const child = spawn(process.execPath, ['src/index.js'], {
  cwd: serverDir,
  env: {
    ...process.env, DATA_DIR: dataDir, PORT: String(port), NODE_ENV: 'development',
    APP_URL: base, SERVER_URL: base, ENABLE_DEV_LOGIN: '1',
    TURNSTILE_SITE_KEY: '', TURNSTILE_SECRET_KEY: '', RESEND_API_KEY: '', SMTP_HOST: '',
    ADMIN_EMAIL: 'admin@members.local', ADMIN_EMAILS: '', SESSION_SECRET: 'isolated-admin-member-tests',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stderr.on('data', (buf) => { output += buf.toString(); });

let checks = 0;
function check(value, expected, name) {
  assert.deepEqual(value, expected, name);
  checks += 1;
  console.log(`ok: ${name}`);
}

function client() {
  const jar = new Map();
  return async (url, method = 'GET', body) => {
    const response = await fetch(`${base}${url}`, {
      method,
      headers: {
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'X-CSRF-Token': jar.get('domashno_csrf') || '' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return { status: response.status, data: await response.json() };
  };
}

async function login(request, email, name) {
  await request('/api/health');
  const r = await request('/api/auth/dev', 'POST', { email, name, terms: true });
  assert.equal(r.status, 200);
  return r.data.user;
}

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 15000);
    child.once('error', reject);
    child.once('exit', () => reject(new Error(`Server exited: ${output}`)));
    child.stdout.on('data', (buf) => {
      if (buf.toString().includes('server listening')) { clearTimeout(timer); resolve(); }
    });
  });

  const admin = client();
  const owner = client();
  const student = client();
  await login(admin, 'admin@members.local', 'Админ');
  await login(owner, 'owner@members.local', 'Класен');
  const studentUser = await login(student, 'student@members.local', 'Ученик');

  const cls = (await owner('/api/classes', 'POST', { name: 'Клас с членове' })).data.class;
  const ownerMember = (await owner(`/api/classes/${cls.id}`)).data.members[0];

  let r = await student(`/api/admin/classes/${cls.id}/members`, 'GET');
  check(r.status, 403, 'non-admin cannot list class members');
  r = await student(`/api/admin/classes/${cls.id}/members`, 'POST', { user_id: studentUser.id });
  check(r.status, 403, 'non-admin cannot add members');

  r = await admin(`/api/admin/classes/${cls.id}/members`, 'GET');
  check(r.status, 200, 'admin can list members');
  check(r.data.members.map((m) => m.id), [ownerMember.id], 'only the owner is a member initially');
  check(r.data.members[0].role, 'owner', 'owner role is reported');

  r = await admin(`/api/admin/classes/${cls.id}/members`, 'POST', { user_id: studentUser.id });
  check(r.status, 201, 'admin can add an existing user');
  check(r.data.members.map((m) => m.id).sort(), [ownerMember.id, studentUser.id].sort(), 'both members are listed');
  check(r.data.members.find((m) => m.id === studentUser.id).role, 'member', 'added user is a plain member');

  r = await student(`/api/classes/${cls.id}`);
  check(r.status, 200, 'added user can open the class');
  check(r.data.class.role, 'member', 'added user has member permissions');

  r = await admin(`/api/admin/classes/${cls.id}/members`, 'POST', { user_id: studentUser.id });
  check(r.status, 409, 'adding the same user twice is rejected');

  r = await admin(`/api/admin/classes/${cls.id}/members`, 'POST', { user_id: 'no-such-user' });
  check(r.status, 400, 'unknown user ids are rejected');

  r = await admin(`/api/admin/classes/${cls.id}/members/${ownerMember.id}`, 'DELETE');
  check(r.status, 400, 'the class owner cannot be removed');

  r = await admin(`/api/admin/classes/${cls.id}/members/${studentUser.id}`, 'DELETE');
  check(r.status, 200, 'admin can remove a member');
  check(r.data.members.map((m) => m.id), [ownerMember.id], 'removed member disappears from the list');

  r = await student(`/api/classes/${cls.id}`);
  check(r.status, 403, 'removed user loses class access');

  r = await admin(`/api/admin/classes/${cls.id}/members/${studentUser.id}`, 'DELETE');
  check(r.status, 404, 'removing a non-member is reported as not found');

  const listed = (await admin('/api/admin/classes')).data.classes.find((c) => c.id === cls.id);
  check(listed.members, 1, 'class member count reflects the change');

  r = await student(`/api/admin/classes/${cls.id}/members`, 'GET');
  check(r.status, 403, 'outsider still cannot use the admin endpoint');

  console.log(`\nALL PASSED (${checks} admin membership checks).`);
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
}
