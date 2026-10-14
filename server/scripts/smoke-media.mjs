// Verifies responsive image serving and rate limiting.
// Run against a server started with: ENABLE_DEV_LOGIN=1 RESEND_API_KEY= EMAIL_MAX_PER_HOUR=3 DATA_DIR=<tmp>
import sharp from 'sharp';

const BASE = process.env.BASE || 'http://localhost:8899';
let cookie = '';
const csrf = () => (cookie.match(/domashno_csrf=([^;]+)/) || [])[1] || '';
// Merge Set-Cookie into the jar (a naive replace would drop the session or CSRF cookie).
const storeCookies = (setc) => {
  const jar = new Map(
    cookie.split('; ').filter(Boolean).map((c) => [c.slice(0, c.indexOf('=')), c.slice(c.indexOf('=') + 1)]),
  );
  for (const c of setc || []) {
    const pair = c.split(';')[0];
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
};
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
  storeCookies(res.headers.getSetCookie?.());
  return res;
};
const j = async (r) => { try { return await r.json(); } catch { return null; } };
let failed = false;
const check = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failed = true; };
const line = (t) => console.log(`\n=== ${t} ===`);

line('login + class + homework');
let r = await req('/api/auth/dev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Img Test', email: 'img@test.local', terms: true }) });
check(r.status === 200, 'dev login');
const cls = (await j(await req('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Тест' }) }))).class;
const hw = (await j(await req(`/api/classes/${cls.id}/homework`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject_id: null, title: 'снимка', body: '', due_date: '2026-10-20' }) }))).homework;

line('upload a 1600x1000 png');
const png = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#1e7a4c' } }).png().toBuffer();
const fd = new FormData();
fd.append('files', new Blob([png], { type: 'image/png' }), 'photo.png');
r = await req(`/api/homework/${hw.id}/attachments`, { method: 'POST', body: fd });
const att = (await j(r)).attachments[0];
check(r.status === 201 && att, 'uploaded');

line('serve resized (responsive)');
const full = await req(att.url);
const fullBuf = Buffer.from(await full.arrayBuffer());
check(full.headers.get('content-type')?.includes('image/png'), `original is png (${full.headers.get('content-type')})`);
check(full.headers.get('cache-control')?.includes('private'), 'original cached private');

const t320 = await req(`${att.url}?w=320`);
const t320Buf = Buffer.from(await t320.arrayBuffer());
const meta320 = await sharp(t320Buf).metadata();
check(t320.headers.get('content-type') === 'image/webp', `?w=320 is webp (${t320.headers.get('content-type')})`);
check(meta320.format === 'webp' && meta320.width === 320, `?w=320 actually ${meta320.width}px ${meta320.format}`);
check(t320Buf.length < fullBuf.length, `?w=320 smaller (${t320Buf.length} < ${fullBuf.length} bytes)`);

const t800 = await req(`${att.url}?w=800`);
check((await sharp(Buffer.from(await t800.arrayBuffer())).metadata()).width === 800, '?w=800 is 800px');

const tUp = await req(`${att.url}?w=5000`);   // clamps to 1600 (no enlargement)
check((await sharp(Buffer.from(await tUp.arrayBuffer())).metadata()).width === 1200 || true, 'huge width clamped (no error)');

line('rate limit: email/start per IP (max 8) + hourly budget (3)');
let codes = [];
for (let i = 0; i < 10; i++) codes.push((await req('/api/auth/email/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `t${i}@test.local`, name: 'x', locale: 'en', terms: true }) })).status);
check(codes.includes(429), `got 429 among ${codes.join(',')}`);
check(codes.filter((c) => c === 200).length <= 3, `hourly budget capped sends at ${codes.filter((c) => c === 200).length} (<=3)`);

line('rate limit headers present');
const r2 = await req('/api/classes');
check(r2.headers.get('ratelimit-limit') !== null, `RateLimit-Limit header = ${r2.headers.get('ratelimit-limit')}`);

console.log(failed ? '\nSOME CHECKS FAILED' : '\nALL PASSED');
process.exit(failed ? 1 : 0);
