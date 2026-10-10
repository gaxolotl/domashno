// Smoke test for the email verification flow.
const BASE = process.env.BASE || 'http://localhost:8787';
const pretty = (o) => JSON.stringify(o);

const start = await fetch(`${BASE}/api/auth/email/start`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'verify-test@example.com', name: 'Проверка', locale: 'bg' }),
});
const s = await start.json();
console.log('start →', pretty(s));
if (!s.ok) { console.error('FAIL: start'); process.exit(1); }
const code = s.devCode;
if (!code) { console.error('FAIL: expected devCode with console provider'); process.exit(1); }

// wrong code
const bad = await fetch(`${BASE}/api/auth/email/verify`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'verify-test@example.com', code: '000000' === code ? '111111' : '000000' }),
});
console.log('verify(wrong) →', bad.status, pretty(await bad.json()));

// right code
const ok = await fetch(`${BASE}/api/auth/email/verify`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'verify-test@example.com', code }),
});
const cookie = (ok.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
const okBody = await ok.json();
console.log('verify(correct) →', ok.status, pretty(okBody));

const me = await fetch(`${BASE}/api/me`, { headers: { Cookie: cookie } });
const meBody = await me.json();
console.log('me →', pretty(meBody));

const pass = ok.status === 200 && meBody.user?.email === 'verify-test@example.com' && meBody.user?.email_verified === true;
console.log(pass ? '\nALL PASSED' : '\nFAILED');
process.exit(pass ? 0 : 1);
