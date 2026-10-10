import { EMAIL, EMAIL_PROVIDER } from './env.js';

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COPY = {
  bg: {
    subject: (code) => `Кодът ти за Домашно: ${code}`,
    preheader: (code, min) => `${code} е кодът ти за вход в Домашно. Валиден ${min} минути.`,
    hello: (name) => `Здравей, ${name}!`,
    intro: 'Въведи този код в Домашно, за да потвърдиш имейла си:',
    expire: (min) => `Кодът е валиден ${min} минути.`,
    or: 'или',
    button: 'Влез с едно натискане',
    ignore: 'Ако не си поискал този код, просто игнорирай имейла — нищо няма да се случи.',
    footerLeft: 'Домашно — разписание и домашни за класа',
    footerRight: 'Автоматично съобщение',
    tagline: 'Разписание и домашни за класа',
  },
  en: {
    subject: (code) => `Your Domashno code: ${code}`,
    preheader: (code, min) => `${code} is your Domashno sign-in code. Valid for ${min} minutes.`,
    hello: (name) => `Hi ${name},`,
    intro: 'Enter this code in Domashno to verify your email:',
    expire: (min) => `The code is valid for ${min} minutes.`,
    or: 'or',
    button: 'Sign in with one tap',
    ignore: "If you didn't request this code, just ignore this email — nothing will happen.",
    footerLeft: 'Domashno — timetable and homework for your class',
    footerRight: 'Automated message',
    tagline: 'Timetable and homework for your class',
  },
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderVerificationEmail({ name, code, link, locale = 'bg', ttlMin = 10 }) {
  const c = COPY[locale] || COPY.bg;
  const subject = c.subject(code);
  const preheader = c.preheader(code, ttlMin);

  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2ec;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all">${esc(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ec;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e2e8e2;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#1e7a4c;padding:18px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="width:30px;height:30px;background:#ffffff;border-radius:9px;text-align:center;vertical-align:middle;font-size:17px;line-height:30px;color:#1e7a4c;font-weight:800;font-family:${FONT};">&#10003;</td>
                <td style="padding-left:10px;color:#ffffff;font-size:17px;font-weight:700;font-family:${FONT};">Домашно</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px 8px;font-family:${FONT};color:#14231c;">
              <p style="margin:0 0 14px;font-size:16px;font-weight:600;">${esc(c.hello(name || ''))}</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3c4b43;">${esc(c.intro)}</p>

              <div style="margin:0 0 8px;text-align:center;">
                <span style="display:inline-block;padding:16px 22px;background:#f4f7f3;border:1px solid #e2e8e2;border-radius:12px;font-size:32px;font-weight:800;letter-spacing:10px;color:#0f2e1e;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${esc(code)}</span>
              </div>
              <p style="margin:0 0 22px;text-align:center;font-size:13px;color:#7a8b80;">${esc(c.expire(ttlMin))}</p>

              <p style="margin:0 0 16px;text-align:center;font-size:13px;color:#7a8b80;">${esc(c.or)}</p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr><td align="center" style="border-radius:12px;background:#c7e86b;">
                  <a href="${esc(link)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:700;color:#16210c;text-decoration:none;border-radius:12px;">${esc(c.button)}</a>
                </td></tr>
              </table>

              <hr style="border:none;border-top:1px solid #edf1ec;margin:0 0 16px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#93a79b;">${esc(c.ignore)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 22px;">
              <hr style="border:none;border-top:1px solid #edf1ec;margin:0 0 14px;">
              <p style="margin:0;font-size:12px;color:#93a79b;font-family:${FONT};">${esc(c.footerLeft)}<br>${esc(c.footerRight)}</p>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-size:11px;color:#a7b4ab;font-family:${FONT};">${esc(c.tagline)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    c.hello(name || ''),
    '',
    c.intro,
    '',
    `    ${code}`,
    '',
    c.expire(ttlMin),
    '',
    `${c.button}: ${link}`,
    '',
    c.ignore,
    '',
    '— ' + c.footerLeft,
  ].join('\n');

  return { subject, html, text };
}

/* ------------------------------- transport -------------------------------- */

async function sendResend({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${EMAIL.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL.from, to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend rejected the message (${res.status}): ${await res.text()}`);
}

let smtpTransport = null;
async function sendSmtp({ to, subject, html, text }) {
  if (!smtpTransport) {
    const { default: nodemailer } = await import('nodemailer');
    smtpTransport = nodemailer.createTransport({
      host: EMAIL.smtp.host,
      port: EMAIL.smtp.port,
      secure: EMAIL.smtp.secure,
      auth: EMAIL.smtp.user ? { user: EMAIL.smtp.user, pass: EMAIL.smtp.pass } : undefined,
    });
  }
  await smtpTransport.sendMail({ from: EMAIL.from, to, subject, html, text });
}

export async function deliver({ to, subject, html, text, code, link }) {
  if (EMAIL_PROVIDER === 'resend') return sendResend({ to, subject, html, text });
  if (EMAIL_PROVIDER === 'smtp') return sendSmtp({ to, subject, html, text });
  // console fallback: no provider configured yet (handy for local development)
  console.log('\n──────────── ДОМАШНО · verification email ────────────');
  console.log(`  to:   ${to}`);
  console.log(`  code: ${code}`);
  console.log(`  link: ${link}`);
  console.log('─────────────────────────────────────────────────────\n');
}

export async function sendVerificationEmail({ to, name, code, link, locale = 'bg', ttlMin = 10 }) {
  const { subject, html, text } = renderVerificationEmail({ name, code, link, locale, ttlMin });
  await deliver({ to, subject, html, text, code, link });
  return EMAIL_PROVIDER;
}
