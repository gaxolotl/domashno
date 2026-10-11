// End-to-end smoke test against the running server.
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8787';
let cookie = '';
const csrf = () => (cookie.match(/domashno_csrf=([^;]+)/) || [])[1] || '';
const req = async (path, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  if (method !== 'GET' && !csrf()) await req('/api/health'); // warm the CSRF cookie first
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(method !== 'GET' ? { 'X-CSRF-Token': csrf() } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  const setc = res.headers.getSetCookie?.() || [];
  if (setc.length) cookie = setc.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
};

const line = (t) => console.log(`\n=== ${t} ===`);
const check = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('ok:', msg); };

line('providers');
let r = await req('/api/auth/providers');
console.log(r.body);
check(r.body.dev === true, 'dev login enabled');

line('dev login');
r = await req('/api/auth/dev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Тест Учител', email: 'test@example.com' }) });
check(r.status === 200, 'logged in');
const meId = r.body.user.id;

line('me');
r = await req('/api/me');
check(r.body.user?.id === meId, 'session persists');

line('create class');
r = await req('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '7 А' }) });
check(r.status === 201, 'class created');
const classId = r.body.class.id;
const invite = r.body.class.invite_code;
console.log('class', classId, 'invite', invite);

line('import PDF');
const pdfPath = process.argv[2];
if (pdfPath && fs.existsSync(pdfPath)) {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' }), 'shkolo.pdf');
  r = await req(`/api/classes/${classId}/import/pdf`, { method: 'POST', body: fd });
  check(r.status === 200, 'import ok');
  console.log('draft name', r.body.draft?.name, 'slots', r.body.draft?.slots?.length, 'source', r.body.draft?.sourceUrl);
  const slots = r.body.draft.slots;
  check(slots.length >= 30, 'enough slots');

  line('save schedule');
  r = await req(`/api/classes/${classId}/schedule`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slots, source_url: r?.body?.draft?.sourceUrl }) });
  check(r.body.saved >= 30, `saved ${r.body.saved} slots`);
  check(r.body.subjects?.length > 5, `${r.body.subjects.length} subjects auto-created`);
  const firstSubject = r.body.subjects[0];

  line('create homework');
  r = await req(`/api/classes/${classId}/homework`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject_id: firstSubject.id, title: 'Упражнение 5', body: 'стр. 42', due_date: '2026-10-14' }) });
  check(r.status === 201, 'homework created');
  const hwId = r.body.homework.id;

  line('attach a file');
  const fd2 = new FormData();
  fd2.append('files', new Blob([Buffer.from('hello pdf')], { type: 'application/pdf' }), 'notes.pdf');
  r = await req(`/api/homework/${hwId}/attachments`, { method: 'POST', body: fd2 });
  check(r.status === 201 && r.body.attachments.length === 1, 'attachment uploaded');
  const fileId = r.body.attachments[0].id;

  line('read file back');
  r = await req(`/api/files/${fileId}`);
  check(r.body === 'hello pdf', 'file content round-trips');

  line('list homework');
  r = await req(`/api/classes/${classId}/homework`);
  check(r.body.homework.length === 1 && r.body.homework[0].attachments.length === 1, 'homework listed with attachment');

  line('class detail');
  r = await req(`/api/classes/${classId}`);
  check(r.body.schedule.length >= 30, 'schedule present');
  check(r.body.members.length === 1, 'one member');
}

line('join with code');
cookie = '';
r = await req('/api/auth/dev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Съученик', email: 'peer@example.com' }) });
check(r.status === 200, 'second user logged in');
r = await req('/api/classes/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: invite }) });
check(r.status === 200 && r.body.class.id === classId, 'joined via invite code');

line('permission: restricted posting');
// owner sets restricted policy
cookie = '';
await req('/api/auth/dev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Тест Учител', email: 'test@example.com' }) });
await req(`/api/classes/${classId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_policy: 'restricted' }) });
// member tries to post -> forbidden
cookie = '';
await req('/api/auth/dev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Съученик', email: 'peer@example.com' }) });
r = await req(`/api/classes/${classId}/homework`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject_id: null, title: 'x', body: '', due_date: '2026-10-14' }) });
check(r.status === 403, 'member blocked when restricted');

console.log('\nDONE', process.exitCode ? '(with failures)' : '(all passed)');
process.exit(process.exitCode || 0);
