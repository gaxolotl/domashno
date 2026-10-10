import Database from 'better-sqlite3';
import { DB_PATH } from './env.js';
import { newId, newInviteCode, newToken, sanitizeText } from './util.js';

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const SUBJECT_COLORS = [
  '#1E7A4C', '#2F6FB0', '#B1539A', '#C2703A', '#8A6D1F',
  '#4C6B8A', '#A63D57', '#3F8F8A', '#7A5AA8', '#6A8E3A',
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  banned_at TEXT,
  ban_reason TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS identities (
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  invite_code TEXT NOT NULL UNIQUE,
  post_policy TEXT NOT NULL DEFAULT 'everyone',
  source_url TEXT,
  features TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL,
  PRIMARY KEY (class_id, user_id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  teacher TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subjects_class ON subjects(class_id);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  period INTEGER NOT NULL,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  label TEXT,
  teacher TEXT,
  room TEXT,
  start_time TEXT,
  end_time TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_slots_class ON slots(class_id);

CREATE TABLE IF NOT EXISTS homework (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT,
  due_date TEXT NOT NULL,
  due_period INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hw_class_due ON homework(class_id, due_date);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  homework_id TEXT NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  stored_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attachments_hw ON attachments(homework_id);

CREATE TABLE IF NOT EXISTS subject_perms (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, user_id)
);

CREATE TABLE IF NOT EXISTS email_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  code_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_email ON email_tokens(email);

CREATE TABLE IF NOT EXISTS login_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  accept_language TEXT,
  timezone TEXT,
  locale TEXT,
  screen TEXT,
  platform TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_name ON schools(name COLLATE NOCASE);
`;

db.exec(SCHEMA);

// Lightweight migrations for databases created by earlier versions.
const classColumns = db.prepare('PRAGMA table_info(classes)').all().map((c) => c.name);
if (!classColumns.includes('source_url')) {
  db.exec('ALTER TABLE classes ADD COLUMN source_url TEXT');
}
const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userColumns.includes('email_verified')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
}
if (!userColumns.includes('banned_at')) db.exec('ALTER TABLE users ADD COLUMN banned_at TEXT');
if (!userColumns.includes('ban_reason')) db.exec('ALTER TABLE users ADD COLUMN ban_reason TEXT');
if (!userColumns.includes('last_seen_at')) db.exec('ALTER TABLE users ADD COLUMN last_seen_at TEXT');
if (!classColumns.includes('features')) db.exec('ALTER TABLE classes ADD COLUMN features TEXT');
if (!classColumns.includes('school_id')) db.exec('ALTER TABLE classes ADD COLUMN school_id TEXT');
const hwColumns = db.prepare('PRAGMA table_info(homework)').all().map((c) => c.name);
if (!hwColumns.includes('due_period')) {
  db.exec('ALTER TABLE homework ADD COLUMN due_period INTEGER');
}

/* ------------------------ per-class feature flags -------------------------- */

export const DEFAULT_FEATURES = { upload_mb: null, read_only: false, featured: false, official: false };

export function parseFeatures(row) {
  if (!row) return { ...DEFAULT_FEATURES };
  try {
    const raw = typeof row === 'string' ? row : row.features;
    return { ...DEFAULT_FEATURES, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_FEATURES };
  }
}

export const serializeFeatures = (f) => JSON.stringify({ ...DEFAULT_FEATURES, ...(f || {}) });

const now = () => new Date().toISOString();

/* ---------------------------------- users --------------------------------- */

export const users = {
  byId: (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  byEmail: (email) =>
    db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email),
  create: ({ name, email = null, avatar_url = null, verified = false }) => {
    const id = newId();
    db.prepare('INSERT INTO users (id,name,email,email_verified,avatar_url,created_at) VALUES (?,?,?,?,?,?)')
      .run(id, sanitizeText(name), email, verified ? 1 : 0, avatar_url, now());
    return users.byId(id);
  },
  rename: (id, name) => {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(sanitizeText(name), id);
    return users.byId(id);
  },
  markVerified: (id) => db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(id),
  findIdentity: (provider, providerUserId) =>
    db.prepare('SELECT * FROM identities WHERE provider = ? AND provider_user_id = ?')
      .get(provider, providerUserId),
  linkIdentity: (provider, providerUserId, userId) => {
    db.prepare('INSERT OR IGNORE INTO identities (provider,provider_user_id,user_id,created_at) VALUES (?,?,?,?)')
      .run(provider, providerUserId, userId, now());
  },
};

/* -------------------------------- sessions -------------------------------- */

const SESSION_DAYS = 60;

export const sessions = {
  create: (userId) => {
    const id = newToken();
    const created = new Date();
    const expires = new Date(created.getTime() + SESSION_DAYS * 864e5);
    db.prepare('INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)')
      .run(id, userId, created.toISOString(), expires.toISOString());
    return { id, expires };
  },
  get: (id) => {
    if (!id) return null;
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!row) return null;
    if (new Date(row.expires_at) < new Date()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      return null;
    }
    return row;
  },
  destroy: (id) => db.prepare('DELETE FROM sessions WHERE id = ?').run(id),
};

/* ----------------------------- email sign-in ------------------------------ */

export const emailTokens = {
  create: ({ id, email, name, codeHash, tokenHash, expiresAt }) => {
    db.prepare('INSERT INTO email_tokens (id,email,name,code_hash,token_hash,created_at,expires_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, email, name ?? null, codeHash, tokenHash, now(), expiresAt);
  },
  latest: (email) =>
    db.prepare('SELECT * FROM email_tokens WHERE email = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1')
      .get(email),
  byId: (id) => db.prepare('SELECT * FROM email_tokens WHERE id = ?').get(id),
  bumpAttempts: (id) => db.prepare('UPDATE email_tokens SET attempts = attempts + 1 WHERE id = ?').run(id),
  consume: (id) => db.prepare('UPDATE email_tokens SET consumed_at = ? WHERE id = ?').run(now(), id),
  recentCount: (email, sinceIso) =>
    db.prepare('SELECT COUNT(*) n FROM email_tokens WHERE email = ? AND created_at >= ?').get(email, sinceIso).n,
  purge: () => db.prepare('DELETE FROM email_tokens WHERE expires_at < ?').run(now()),
};

/* --------------------------------- classes -------------------------------- */

function uniqueInviteCode() {
  for (let i = 0; i < 20; i++) {
    const code = newInviteCode();
    if (!db.prepare('SELECT 1 FROM classes WHERE invite_code = ?').get(code)) return code;
  }
  return newInviteCode(8);
}

export const classes = {
  create: ({ name, ownerId }) => {
    const id = newId();
    const code = uniqueInviteCode();
    db.prepare('INSERT INTO classes (id,name,owner_id,invite_code,created_at) VALUES (?,?,?,?,?)')
      .run(id, sanitizeText(name), ownerId, code, now());
    members.add(id, ownerId, 'owner');
    return classes.byId(id);
  },
  byId: (id) => db.prepare('SELECT * FROM classes WHERE id = ?').get(id),
  byInvite: (code) =>
    db.prepare('SELECT * FROM classes WHERE invite_code = ? COLLATE NOCASE')
      .get(String(code || '').trim()),
  listForUser: (userId) =>
    db.prepare(`
      SELECT c.*, m.role,
        (SELECT COUNT(*) FROM members mm WHERE mm.class_id = c.id) AS member_count,
        (SELECT COUNT(*) FROM subjects s WHERE s.class_id = c.id) AS subject_count,
        (SELECT COUNT(*) FROM homework h WHERE h.class_id = c.id) AS homework_count
      FROM classes c
      JOIN members m ON m.class_id = c.id
      WHERE m.user_id = ?
      ORDER BY m.created_at ASC
    `).all(userId),
  update: (id, { name, post_policy, source_url }) => {
    if (name !== undefined) db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(sanitizeText(name), id);
    if (post_policy !== undefined)
      db.prepare('UPDATE classes SET post_policy = ? WHERE id = ?').run(post_policy, id);
    if (source_url !== undefined)
      db.prepare('UPDATE classes SET source_url = ? WHERE id = ?').run(source_url, id);
    return classes.byId(id);
  },
  regenerateInvite: (id) => {
    const code = uniqueInviteCode();
    db.prepare('UPDATE classes SET invite_code = ? WHERE id = ?').run(code, id);
    return code;
  },
  remove: (id) => db.prepare('DELETE FROM classes WHERE id = ?').run(id),
};

export const members = {
  add: (classId, userId, role = 'member') =>
    db.prepare('INSERT OR IGNORE INTO members (class_id,user_id,role,created_at) VALUES (?,?,?,?)')
      .run(classId, userId, role, now()),
  get: (classId, userId) =>
    db.prepare('SELECT * FROM members WHERE class_id = ? AND user_id = ?').get(classId, userId),
  list: (classId) =>
    db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar_url, m.role, m.created_at AS joined_at
      FROM members m JOIN users u ON u.id = m.user_id
      WHERE m.class_id = ?
      ORDER BY (m.role='owner') DESC, m.created_at ASC
    `).all(classId),
  setRole: (classId, userId, role) =>
    db.prepare('UPDATE members SET role = ? WHERE class_id = ? AND user_id = ?').run(role, classId, userId),
  remove: (classId, userId) =>
    db.prepare('DELETE FROM members WHERE class_id = ? AND user_id = ?').run(classId, userId),
  count: (classId) => db.prepare('SELECT COUNT(*) n FROM members WHERE class_id = ?').get(classId).n,
};

/* -------------------------------- subjects -------------------------------- */

export const subjects = {
  list: (classId) =>
    db.prepare('SELECT * FROM subjects WHERE class_id = ? ORDER BY sort ASC, name ASC').all(classId),
  byId: (id) => db.prepare('SELECT * FROM subjects WHERE id = ?').get(id),
  byName: (classId, name) =>
    db.prepare('SELECT * FROM subjects WHERE class_id = ? AND lower(name) = lower(?)').get(classId, name),
  create: ({ classId, name, color, teacher }) => {
    const id = newId();
    const sort = (db.prepare('SELECT COALESCE(MAX(sort),-1)+1 n FROM subjects WHERE class_id = ?').get(classId).n);
    const chosen = color || SUBJECT_COLORS[sort % SUBJECT_COLORS.length];
    db.prepare('INSERT INTO subjects (id,class_id,name,color,teacher,sort,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, classId, sanitizeText(name), chosen, sanitizeText(teacher) || null, sort, now());
    return subjects.byId(id);
  },
  update: (id, { name, color, teacher }) => {
    const s = subjects.byId(id);
    if (!s) return null;
    db.prepare('UPDATE subjects SET name = ?, color = ?, teacher = ? WHERE id = ?').run(
      sanitizeText(name ?? s.name), color ?? s.color,
      teacher === undefined ? s.teacher : (sanitizeText(teacher) || null), id,
    );
    return subjects.byId(id);
  },
  remove: (id) => db.prepare('DELETE FROM subjects WHERE id = ?').run(id),
};

/* ---------------------------------- slots --------------------------------- */

export const slots = {
  list: (classId) =>
    db.prepare('SELECT * FROM slots WHERE class_id = ? ORDER BY day ASC, period ASC').all(classId),
  replace: db.transaction((classId, list) => {
    db.prepare('DELETE FROM slots WHERE class_id = ?').run(classId);
    const ins = db.prepare(`INSERT INTO slots
      (id,class_id,day,period,subject_id,label,teacher,room,start_time,end_time,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    for (const s of list) {
      ins.run(newId(), classId, s.day, s.period, s.subject_id ?? null,
        sanitizeText(s.label) || null, sanitizeText(s.teacher) || null, sanitizeText(s.room) || null,
        s.start_time ?? null, s.end_time ?? null, now());
    }
  }),
};

/* -------------------------------- homework -------------------------------- */

function hydrateHomework(row) {
  if (!row) return null;
  const subject = row.subject_id ? subjects.byId(row.subject_id) : null;
  const author = users.byId(row.created_by);
  return {
    ...row,
    subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null,
    author: author ? { id: author.id, name: author.name, avatar_url: author.avatar_url } : null,
    attachments: attachments.listByHomework(row.id),
  };
}

export const homework = {
  list: (classId, { from, to, subjectId } = {}) => {
    let sql = 'SELECT * FROM homework WHERE class_id = ?';
    const args = [classId];
    if (from) { sql += ' AND due_date >= ?'; args.push(from); }
    if (to) { sql += ' AND due_date <= ?'; args.push(to); }
    if (subjectId) { sql += ' AND subject_id = ?'; args.push(subjectId); }
    sql += ' ORDER BY due_date ASC, created_at ASC';
    return db.prepare(sql).all(...args).map(hydrateHomework);
  },
  byId: (id) => hydrateHomework(db.prepare('SELECT * FROM homework WHERE id = ?').get(id)),
  raw: (id) => db.prepare('SELECT * FROM homework WHERE id = ?').get(id),
  create: ({ classId, subjectId, createdBy, title, body, dueDate, duePeriod = null }) => {
    const id = newId();
    db.prepare(`INSERT INTO homework
      (id,class_id,subject_id,created_by,title,body,due_date,due_period,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(id, classId, subjectId ?? null, createdBy, sanitizeText(title),
        body == null ? null : sanitizeText(body), dueDate, duePeriod ?? null, now(), now());
    return homework.byId(id);
  },
  update: (id, { subjectId, title, body, dueDate, duePeriod }) => {
    const h = homework.raw(id);
    if (!h) return null;
    db.prepare('UPDATE homework SET subject_id = ?, title = ?, body = ?, due_date = ?, due_period = ?, updated_at = ? WHERE id = ?')
      .run(subjectId === undefined ? h.subject_id : subjectId, sanitizeText(title ?? h.title),
        body === undefined ? h.body : (body == null ? null : sanitizeText(body)), dueDate ?? h.due_date,
        duePeriod === undefined ? h.due_period : duePeriod, now(), id);
    return homework.byId(id);
  },
  remove: (id) => db.prepare('DELETE FROM homework WHERE id = ?').run(id),
};

/* ------------------------------ attachments ------------------------------- */

export const attachments = {
  listByHomework: (homeworkId) =>
    db.prepare('SELECT * FROM attachments WHERE homework_id = ? ORDER BY created_at ASC').all(homeworkId),
  byId: (id) => db.prepare('SELECT * FROM attachments WHERE id = ?').get(id),
  create: ({ homeworkId, storedName, originalName, mime, size }) => {
    const id = newId();
    db.prepare(`INSERT INTO attachments
      (id,homework_id,stored_name,original_name,mime,size,created_at) VALUES (?,?,?,?,?,?,?)`)
      .run(id, homeworkId, storedName, originalName, mime ?? null, size ?? 0, now());
    return attachments.byId(id);
  },
  remove: (id) => db.prepare('DELETE FROM attachments WHERE id = ?').run(id),
};

/* --------------------------- subject permissions -------------------------- */

export const subjectPerms = {
  list: (subjectId) =>
    db.prepare('SELECT user_id FROM subject_perms WHERE subject_id = ?').all(subjectId).map((r) => r.user_id),
  set: db.transaction((classId, subjectId, userIds) => {
    db.prepare('DELETE FROM subject_perms WHERE subject_id = ?').run(subjectId);
    const ins = db.prepare('INSERT OR IGNORE INTO subject_perms (class_id,subject_id,user_id) VALUES (?,?,?)');
    for (const uid of userIds) ins.run(classId, subjectId, uid);
  }),
  has: (subjectId, userId) =>
    Boolean(db.prepare('SELECT 1 FROM subject_perms WHERE subject_id = ? AND user_id = ?').get(subjectId, userId)),
  countForSubject: (subjectId) =>
    db.prepare('SELECT COUNT(*) n FROM subject_perms WHERE subject_id = ?').get(subjectId).n,
};

/* ------------------------------- permissions ------------------------------ */

export function canPostFor(classId, subjectId, userId) {
  if (!userId) return false;
  const membership = members.get(classId, userId);
  if (!membership) return false;
  if (membership.role === 'owner') return true;
  const cls = classes.byId(classId);
  if (cls && cls.post_policy === 'everyone') return true;
  if (subjectId && subjectPerms.has(subjectId, userId)) return true;
  return false;
}

/* ------------------------------ login events ------------------------------ */

const FIFTEEN_MIN = 15 * 60_000;

export const loginEvents = {
  add: ({ userId, ip, userAgent, acceptLanguage }) => {
    db.prepare(`INSERT INTO login_events (id,user_id,ip,user_agent,accept_language,created_at)
      VALUES (?,?,?,?,?,?)`)
      .run(newId(), userId, ip ?? null, userAgent ?? null, acceptLanguage ?? null, now());
  },
  /** Fill in the client-side bits (timezone, screen…) on the newest pending event. */
  attachClient: ({ userId, timezone, locale, screen, platform }) => {
    const since = new Date(Date.now() - FIFTEEN_MIN).toISOString();
    const row = db.prepare(
      'SELECT id FROM login_events WHERE user_id = ? AND timezone IS NULL AND created_at >= ? ORDER BY created_at DESC LIMIT 1',
    ).get(userId, since);
    if (row) {
      db.prepare('UPDATE login_events SET timezone = ?, locale = ?, screen = ?, platform = ? WHERE id = ?')
        .run(timezone ?? null, locale ?? null, screen ?? null, platform ?? null, row.id);
      return;
    }
    db.prepare(`INSERT INTO login_events (id,user_id,timezone,locale,screen,platform,created_at)
      VALUES (?,?,?,?,?,?,?)`)
      .run(newId(), userId, timezone ?? null, locale ?? null, screen ?? null, platform ?? null, now());
  },
  forUser: (userId, limit = 25) =>
    db.prepare('SELECT * FROM login_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit),
  recent: (limit = 60) =>
    db.prepare(`
      SELECT e.*, u.name AS user_name, u.email AS user_email
      FROM login_events e JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at DESC LIMIT ?
    `).all(limit),
  distinctIpsForUser: (userId) =>
    db.prepare('SELECT ip, COUNT(*) n, MAX(created_at) last FROM login_events WHERE user_id = ? AND ip IS NOT NULL GROUP BY ip ORDER BY last DESC').all(userId),
};

/* --------------------------------- admin ---------------------------------- */

export const admin = {
  setBanned: (id, banned, reason = null) => {
    db.prepare('UPDATE users SET banned_at = ?, ban_reason = ? WHERE id = ?')
      .run(banned ? now() : null, banned ? (reason || null) : null, id);
    return users.byId(id);
  },
  setEmail: (id, email) => {
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email || null, id);
    return users.byId(id);
  },
  setVerified: (id, verified) => {
    db.prepare('UPDATE users SET email_verified = ? WHERE id = ?').run(verified ? 1 : 0, id);
    return users.byId(id);
  },
  touchLastSeen: (id) => db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), id),
  removeUser: (id) => db.prepare('DELETE FROM users WHERE id = ?').run(id),
  revokeSessions: (userId) => db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId).changes,
  setClassFeatures: (id, features) =>
    db.prepare('UPDATE classes SET features = ? WHERE id = ?').run(serializeFeatures(features), id),
};

export const stats = () => {
  const one = (sql, ...args) => db.prepare(sql).get(...args).n;
  const pct = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const hours = (h) => new Date(Date.now() - h * 3600_000).toISOString();
  return {
    users: one('SELECT COUNT(*) n FROM users'),
    verified: one('SELECT COUNT(*) n FROM users WHERE email_verified = 1'),
    banned: one('SELECT COUNT(*) n FROM users WHERE banned_at IS NOT NULL'),
    classes: one('SELECT COUNT(*) n FROM classes'),
    subjects: one('SELECT COUNT(*) n FROM subjects'),
    slots: one('SELECT COUNT(*) n FROM slots'),
    homework: one('SELECT COUNT(*) n FROM homework'),
    attachments: one('SELECT COUNT(*) n FROM attachments'),
    storageBytes: db.prepare('SELECT COALESCE(SUM(size),0) n FROM attachments').get().n,
    activeSessions: one('SELECT COUNT(*) n FROM sessions WHERE expires_at > ?', now()),
    newUsers7: one('SELECT COUNT(*) n FROM users WHERE created_at >= ?', pct(7)),
    newUsers30: one('SELECT COUNT(*) n FROM users WHERE created_at >= ?', pct(30)),
    homework7: one('SELECT COUNT(*) n FROM homework WHERE created_at >= ?', pct(7)),
    logins24: one('SELECT COUNT(*) n FROM login_events WHERE created_at >= ?', hours(24)),
    providers: db.prepare('SELECT provider, COUNT(*) n FROM identities GROUP BY provider').all(),
    topClasses: db.prepare(`
      SELECT c.id, c.name, u.name AS owner,
        (SELECT COUNT(*) FROM members m WHERE m.class_id = c.id) AS members,
        (SELECT COUNT(*) FROM homework h WHERE h.class_id = c.id) AS homework
      FROM classes c JOIN users u ON u.id = c.owner_id
      ORDER BY members DESC, homework DESC LIMIT 8
    `).all(),
    recentUsers: db.prepare(`
      SELECT u.id, u.name, u.email, u.email_verified, u.banned_at, u.created_at,
        (SELECT COUNT(*) FROM members m WHERE m.user_id = u.id) AS classes
      FROM users u ORDER BY u.created_at DESC LIMIT 8
    `).all(),
  };
};

export const adminUsers = {
  list: ({ q = '', filter = 'all', limit = 50, offset = 0 }) => {
    const where = [];
    const args = [];
    if (q) { where.push('(lower(name) LIKE ? OR lower(email) LIKE ?)'); args.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`); }
    if (filter === 'banned') where.push('banned_at IS NOT NULL');
    if (filter === 'unverified') where.push('email_verified = 0');
    if (filter === 'verified') where.push('email_verified = 1');
    const sql = `
      SELECT u.*,
        (SELECT COUNT(*) FROM members m WHERE m.user_id = u.id) AS classes,
        (SELECT COUNT(*) FROM homework h WHERE h.created_by = u.id) AS homework,
        (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS sessions
      FROM users u
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    return db.prepare(sql).all(now(), ...args, limit, offset);
  },
  count: ({ q = '', filter = 'all' }) => {
    const where = [];
    const args = [];
    if (q) { where.push('(lower(name) LIKE ? OR lower(email) LIKE ?)'); args.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`); }
    if (filter === 'banned') where.push('banned_at IS NOT NULL');
    if (filter === 'unverified') where.push('email_verified = 0');
    if (filter === 'verified') where.push('email_verified = 1');
    return db.prepare(`SELECT COUNT(*) n FROM users ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`).get(...args).n;
  },
  membershipsFor: (userId) => db.prepare(`
    SELECT c.id, c.name, m.role, c.created_at,
      (SELECT COUNT(*) FROM members mm WHERE mm.class_id = c.id) AS members,
      (SELECT COUNT(*) FROM homework h WHERE h.class_id = c.id) AS homework
    FROM members m JOIN classes c ON c.id = m.class_id
    WHERE m.user_id = ?
    ORDER BY c.created_at DESC
  `).all(userId),
};

export const adminClasses = {
  list: (q = '') => db.prepare(`
    SELECT c.*, u.name AS owner_name, u.email AS owner_email, sc.name AS school_name,
      (SELECT COUNT(*) FROM members m WHERE m.class_id = c.id) AS members,
      (SELECT COUNT(*) FROM homework h WHERE h.class_id = c.id) AS homework,
      (SELECT COUNT(*) FROM subjects s WHERE s.class_id = c.id) AS subjects
    FROM classes c
    JOIN users u ON u.id = c.owner_id
    LEFT JOIN schools sc ON sc.id = c.school_id
    ${q ? 'WHERE lower(c.name) LIKE ?' : ''}
    ORDER BY c.created_at DESC LIMIT 200
  `).all(...(q ? [`%${q.toLowerCase()}%`] : [])),
};

/* --------------------------------- schools -------------------------------- */

export const schools = {
  list: () => db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM classes c WHERE c.school_id = s.id) AS classes
    FROM schools s ORDER BY s.name COLLATE NOCASE
  `).all(),
  byId: (id) => db.prepare('SELECT * FROM schools WHERE id = ?').get(id),
  byName: (name) => db.prepare('SELECT * FROM schools WHERE name = ? COLLATE NOCASE').get(name),
  create: ({ name, domain = null }) => {
    const id = newId();
    db.prepare('INSERT INTO schools (id,name,domain,created_at) VALUES (?,?,?,?)')
      .run(id, sanitizeText(name), domain ? sanitizeText(domain) : null, now());
    return schools.byId(id);
  },
  update: (id, { name, domain }) => {
    const s = schools.byId(id);
    if (!s) return null;
    db.prepare('UPDATE schools SET name = ?, domain = ? WHERE id = ?')
      .run(name === undefined ? s.name : sanitizeText(name), domain === undefined ? s.domain : (domain ? sanitizeText(domain) : null), id);
    return schools.byId(id);
  },
  remove: (id) => {
    db.prepare('UPDATE classes SET school_id = NULL WHERE school_id = ?').run(id);
    db.prepare('DELETE FROM schools WHERE id = ?').run(id);
  },
  setClassSchool: (classId, schoolId) =>
    db.prepare('UPDATE classes SET school_id = ? WHERE id = ?').run(schoolId ?? null, classId),
  /** Find a school by name, creating it when missing. Empty name → null (unlink). */
  findOrCreate: (name) => {
    const clean = sanitizeText(name);
    if (!clean) return null;
    return schools.byName(clean) || schools.create({ name: clean });
  },
};
