import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_DIR = path.resolve(__dirname, '..');
export const ROOT_DIR = path.resolve(SERVER_DIR, '..');

// Load .env from the project root (preferred) then from the server folder.
for (const file of [path.join(ROOT_DIR, '.env'), path.join(SERVER_DIR, '.env')]) {
  if (fs.existsSync(file)) dotenv.config({ path: file });
}

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(SERVER_DIR, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'domashno.db');
export const WEB_DIST = path.join(ROOT_DIR, 'web', 'dist');

export const PORT = num(process.env.PORT, 8787);
export const SERVER_URL = (process.env.SERVER_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
export const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
export const SESSION_SECRET = process.env.SESSION_SECRET || 'domashno-dev-secret-change-me';
export const ENABLE_DEV_LOGIN = String(process.env.ENABLE_DEV_LOGIN ?? '1') === '1';
export const MAX_UPLOAD_MB = num(process.env.MAX_UPLOAD_MB, 25);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PROD = NODE_ENV === 'production';

export const OAUTH = {
  google: {
    id: process.env.GOOGLE_CLIENT_ID || '',
    secret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  github: {
    id: process.env.GITHUB_CLIENT_ID || '',
    secret: process.env.GITHUB_CLIENT_SECRET || '',
  },
};

/** Email delivery for sign-up verification codes / links. */
export const EMAIL = {
  from: process.env.EMAIL_FROM || 'Домашно <onboarding@resend.dev>',
  resendApiKey: process.env.RESEND_API_KEY || '',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    secure: String(process.env.SMTP_SECURE || '') === '1' || num(process.env.SMTP_PORT, 587) === 465,
  },
};

/** resend → API key, else smtp → SMTP host, else console (dev: code printed to the log). */
export const EMAIL_PROVIDER = EMAIL.resendApiKey ? 'resend' : EMAIL.smtp.host ? 'smtp' : 'console';
export const VERIFICATION_TTL_MIN = 10;

/** Hard cap on verification emails sent per hour (protects your provider quota). */
export const EMAIL_MAX_PER_HOUR = num(process.env.EMAIL_MAX_PER_HOUR, 300);

export function oauthEnabled(provider) {
  const p = OAUTH[provider];
  return Boolean(p && p.id && p.secret);
}

export function callbackUrl(provider) {
  return `${SERVER_URL}/api/auth/${provider}/callback`;
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
