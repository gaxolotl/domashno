// Integration checks for shared lesson logs and announced tests. Starts a
// child server with its own temporary database; never touches server/data.
// Run: node scripts/test-class-features.mjs
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
const dataDir = fs.mkdtempSync(path.join(temporaryRoot, 'domashno-class-features-'));
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
    ADMIN_EMAIL: '', ADMIN_EMAILS: '', SESSION_SECRET: 'isolated-feature-tests-only',
    SCHOOL_TIME_ZONE: 'Europe/Sofia',
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
  return r.data.user.id;
}

const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shift = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 15000);
    child.once('error', reject);
    child.once('exit', () => reject(new Error(`Server exited: ${output}`)));
    child.stdout.on('data', (buf) => {
      if (buf.toString().includes('server listening')) { clearTimeout(timer); resolve(); }
    });
  });

  const owner = client();
  const alice = client();
  const bob = client();
  const outsider = client();
  const anonymous = client();
  await login(owner, 'owner@features.local', 'Класен');
  const aliceId = await login(alice, 'alice@features.local', 'Никола');
  await login(bob, 'bob@features.local', 'Елена');
  await login(outsider, 'outsider@features.local', 'Друг клас');
  const cls = (await owner('/api/classes', 'POST', { name: 'Тестов клас' })).data.class;
  const id = cls.id;
  await alice('/api/classes/join', 'POST', { code: cls.invite_code });
  await bob('/api/classes/join', 'POST', { code: cls.invite_code });

  const slot = (day, period, subject, start = '00:00') => ({ day, period, subject, teacher: 'Учител', room: '', start, end: '23:59' });
  const schedule = Array.from({ length: 7 }, (_, i) => [
    slot(i + 1, 0, 'Мат'), slot(i + 1, 1, 'БЕЛ'), slot(i + 1, 2, 'БЕЛ'),
    slot(i + 1, 3, 'Мат (ИУЧ)'), slot(i + 1, 4, 'История', '23:59'),
  ]).flat();
  const saved = await owner(`/api/classes/${id}/schedule`, 'PUT', { slots: schedule });
  const math = saved.data.subjects.find((s) => s.name === 'Мат').id;
  const lit = saved.data.subjects.find((s) => s.name === 'БЕЛ').id;
  const advanced = saved.data.subjects.find((s) => s.name === 'Мат (ИУЧ)').id;
  const yesterday = shift(date, -1);
  const tomorrow = shift(date, 1);
  const logsPath = `/api/classes/${id}/lesson-logs`;

  check((await anonymous(logsPath)).status, 401, 'anonymous cannot see lesson logs');
  check((await outsider(logsPath)).status, 403, 'nonmember cannot see lesson logs');
  check((await outsider(logsPath, 'PUT', { date, period: 0 })).status, 403, 'nonmember cannot log a lesson');
  check((await alice(logsPath, 'PUT', { date: '2026-02-30', period: 0 })).status, 400, 'impossible calendar date rejected');
  check((await alice(logsPath, 'PUT', { date, period: 12 })).status, 400, 'unscheduled period rejected');
  check((await alice(logsPath, 'PUT', { date: tomorrow, period: 0 })).status, 400, 'future lesson rejected');
  check((await alice(logsPath, 'PUT', { date, period: 4 })).status, 400, 'lesson that has not started rejected');
  check((await alice(logsPath, 'PUT', { date, period: 0, subject_id: lit })).status, 400, 'wrong subject for source period rejected');
  const logged = await alice(logsPath, 'PUT', { date, period: 0, subject_id: math });
  check(logged.status, 200, 'student can manually log period zero');
  check(logged.data.log.logger.id, aliceId, 'log attributes the student');
  const repeat = await bob(logsPath, 'PUT', { date, period: 0 });
  check(repeat.data.log.id, logged.data.log.id, 'same occurrence is idempotent');
  check(repeat.data.log.logger.id, aliceId, 'later student does not overwrite the first logger');
  check((await bob(`${logsPath}?date=${date}&period=0`, 'DELETE')).status, 403, 'another student cannot remove the log');
  check((await alice(`${logsPath}?date=${date}&period=0`, 'DELETE')).status, 200, 'logger can undo a mistake');

  const hw = { subject_id: math, title: 'Задачи', body: '', due_date: tomorrow };
  const auto = await alice(`/api/classes/${id}/homework`, 'POST', { ...hw, lesson_date: date, lesson_period: 0, lesson_subject_id: math });
  check(auto.status, 201, 'homework with a source lesson saves');
  check(auto.data.lesson_log.logger.id, aliceId, 'homework automatically logs the source occurrence');
  const later = await bob(`/api/classes/${id}/homework`, 'POST', { ...hw, lesson_date: date, lesson_period: 0, lesson_subject_id: math });
  check(later.data.lesson_log.logger.id, aliceId, 'later homework preserves the original logger');
  const variant = await alice(`/api/classes/${id}/homework`, 'POST', {
    ...hw, subject_id: advanced, lesson_date: date, lesson_period: 1, lesson_subject_id: lit,
  });
  check(variant.data.lesson_log.subject_id, lit, 'variant pill does not change the recorded source lesson');
  const future = await alice(`/api/classes/${id}/homework`, 'POST', { ...hw, lesson_date: tomorrow, lesson_period: 0 });
  check(future.data.lesson_log, null, 'future due lesson creates no false attendance record');
  const noSource = await bob(`/api/classes/${id}/homework`, 'POST', { ...hw, subject_id: lit });
  check(noSource.data.lesson_log.period, 2, 'Homework tab infers only the latest started occurrence today');
  const countBefore = (await owner(`/api/classes/${id}/homework`)).data.homework.length;
  check((await alice(`/api/classes/${id}/homework`, 'POST', { ...hw, lesson_date: date, lesson_period: 12 })).status, 400, 'invalid source rejected before homework insertion');
  check((await owner(`/api/classes/${id}/homework`)).data.homework.length, countBefore, 'invalid source leaves no partial homework');
  const history = await alice(logsPath, 'PUT', { date: yesterday, period: 3, subject_id: advanced });
  await owner(`/api/classes/${id}/schedule`, 'PUT', { slots: schedule.map((s) => ({ ...s, subject: 'Нов предмет' })) });
  check((await owner(logsPath)).data.logs.find((l) => l.id === history.data.log.id).subject_name, 'Мат (ИУЧ)', 'history survives timetable replacement');
  await owner(`/api/classes/${id}/schedule`, 'PUT', { slots: schedule });
  check((await owner(`${logsPath}?date=${yesterday}&period=3`, 'DELETE')).status, 200, 'class owner can remove a mistaken log');
  check((await owner(`${logsPath}?from=${date}&to=${date}`)).data.logs.every((l) => l.date === date), true, 'log query filters by occurrence date');

  // Test announcements are open to all classmates even if homework is restricted.
  await owner(`/api/classes/${id}`, 'PATCH', { post_policy: 'restricted' });
  const test = { subject_id: math, kind: 'test', title: 'Контролно: дроби', details: 'Стр. 20–30\nБез калкулатор', test_date: tomorrow, period: 0 };
  const created = await alice(`/api/classes/${id}/tests`, 'POST', test);
  check(created.status, 201, 'student can announce a test independently of homework permissions');
  const testId = created.data.test.id;
  check(created.data.test.author.id, aliceId, 'announcement records its author');
  check(created.data.test.period, 0, 'test preserves period zero');
  check((await bob(`/api/classes/${id}/tests`)).data.tests[0].details, test.details, 'all classmates see known details');
  check((await anonymous(`/api/classes/${id}/tests`)).status, 401, 'anonymous cannot see tests');
  check((await outsider(`/api/classes/${id}/tests`)).status, 403, 'nonmember cannot see tests');
  check((await outsider(`/api/tests/${testId}`, 'PATCH', { title: 'attack' })).status, 403, 'cross-class edit blocked');
  check((await bob(`/api/tests/${testId}`, 'PATCH', { title: 'overwrite' })).status, 403, 'unrelated classmate cannot overwrite announcement');
  check((await bob(`/api/tests/${testId}`, 'DELETE')).status, 403, 'unrelated classmate cannot delete announcement');
  check((await alice(`/api/tests/${testId}`, 'PATCH', { details: 'Глава 2' })).data.test.details, 'Глава 2', 'author can add new information');
  check((await owner(`/api/tests/${testId}`, 'PATCH', { title: 'Коригирано контролно' })).status, 200, 'class owner can correct an announcement');
  const pending = await bob(`/api/classes/${id}/tests`, 'POST', { ...test, test_date: null, period: null });
  check(pending.data.test.test_date, null, 'date not announced is supported');
  const scheduled = await bob(`/api/tests/${pending.data.test.id}`, 'PATCH', { test_date: tomorrow });
  check(scheduled.data.test.test_date, tomorrow, 'unknown date can later be scheduled');
  check((await bob(`/api/tests/${pending.data.test.id}`, 'PATCH', { test_date: null })).data.test.test_date, null, 'date can be cleared without losing other details');
  check((await alice(`/api/classes/${id}/tests`, 'POST', { ...test, test_date: '2026-02-30' })).status, 400, 'invalid test date rejected');
  check((await alice(`/api/classes/${id}/tests`, 'POST', { ...test, kind: 'invalid' })).status, 400, 'invalid test kind rejected');
  check((await alice(`/api/classes/${id}/tests`, 'POST', { ...test, period: 1.5 })).status, 400, 'fractional test period rejected');
  const other = (await outsider('/api/classes', 'POST', { name: 'Чужд клас' })).data.class;
  const foreignSubject = (await outsider(`/api/classes/${other.id}/subjects`, 'POST', { name: 'Чужд предмет' })).data.subject.id;
  check((await alice(`/api/tests/${testId}`, 'PATCH', { subject_id: foreignSubject })).status, 400, 'foreign subject edit rejected');
  check((await alice(`/api/classes/${id}/tests`, 'POST', { ...test, subject_id: foreignSubject })).status, 400, 'foreign subject create rejected');

  // Freeze using the database in this test environment (these users are not admins).
  const { createRequire } = await import('node:module');
  const require = createRequire(path.join(serverDir, 'package.json'));
  const Database = require('better-sqlite3');
  const db = new Database(path.join(dataDir, 'domashno.db'));
  db.prepare('UPDATE classes SET features = ? WHERE id = ?').run(JSON.stringify({ read_only: true }), id);
  check((await alice(logsPath, 'PUT', { date: yesterday, period: 0 })).status, 403, 'read-only class blocks logging');
  check((await alice(`/api/classes/${id}/tests`, 'POST', test)).status, 403, 'read-only class blocks test creation');
  check((await alice(`/api/tests/${testId}`, 'PATCH', { title: 'edit' })).status, 403, 'read-only class blocks test edit');
  check((await owner(`/api/tests/${testId}`, 'DELETE')).status, 403, 'read-only class blocks deletion even by class owner');
  db.prepare('UPDATE classes SET features = NULL WHERE id = ?').run(id);
  check((await owner(`/api/tests/${testId}`, 'DELETE')).status, 200, 'class owner can delete after unfreezing');
  await owner(`/api/classes/${id}`, 'DELETE');
  check(db.prepare('SELECT COUNT(*) n FROM lesson_logs WHERE class_id=?').get(id).n, 0, 'class deletion cascades to lesson logs');
  check(db.prepare('SELECT COUNT(*) n FROM tests WHERE class_id=?').get(id).n, 0, 'class deletion cascades to tests');
  db.close();
  console.log(`\nALL PASSED (${checks} checks). Existing data untouched.`);
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
}
