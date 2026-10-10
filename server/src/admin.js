// Admin panel API. Guarded by requireAdmin — access is granted to whoever signs in
// with an address listed in ADMIN_EMAIL / ADMIN_EMAILS (see .env).
import express from 'express';
import { requireAdmin } from './auth.js';
import {
  users, admin as adminDb, adminUsers, adminClasses, classes, schools,
  loginEvents, stats, parseFeatures, DEFAULT_FEATURES,
} from './db.js';
import { badRequest, notFound, wrap, sanitizeText } from './util.js';
import { ADMIN_EMAILS } from './env.js';

export const adminRoutes = express.Router();
adminRoutes.use(requireAdmin);

const userView = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  email_verified: Boolean(u.email_verified),
  avatar_url: u.avatar_url,
  banned: Boolean(u.banned_at),
  banned_at: u.banned_at,
  ban_reason: u.ban_reason ?? null,
  last_seen_at: u.last_seen_at ?? null,
  created_at: u.created_at,
  classes: u.classes,
  homework: u.homework,
  sessions: u.sessions,
});

const classView = (c) => ({
  id: c.id,
  name: c.name,
  owner_name: c.owner_name,
  owner_email: c.owner_email,
  invite_code: c.invite_code,
  post_policy: c.post_policy,
  source_url: c.source_url ?? null,
  members: c.members,
  homework: c.homework,
  subjects: c.subjects,
  created_at: c.created_at,
  features: parseFeatures(c),
  school: c.school_id && c.school_name ? { id: c.school_id, name: c.school_name } : null,
});

/* ---------------------------------- stats --------------------------------- */

adminRoutes.get('/stats', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ stats: stats(), adminEmails: ADMIN_EMAILS });
});

/* ---------------------------------- users --------------------------------- */

adminRoutes.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim();
  const filter = String(req.query.filter || 'all');
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.set('Cache-Control', 'no-store');
  res.json({
    users: adminUsers.list({ q, filter, limit, offset }).map(userView),
    total: adminUsers.count({ q, filter }),
  });
});

adminRoutes.get('/users/:id', (req, res) => {
  const user = users.byId(req.params.id);
  if (!user) return notFound(res, 'User not found');
  res.set('Cache-Control', 'no-store');
  res.json({
    user: userView(user),
    memberships: adminUsers.membershipsFor(user.id),
    logins: loginEvents.forUser(user.id, 30),
    ips: loginEvents.distinctIpsForUser(user.id),
  });
});

adminRoutes.patch('/users/:id', wrap(async (req, res) => {
  const user = users.byId(req.params.id);
  if (!user) return notFound(res, 'User not found');

  if (req.body?.name !== undefined) {
    const name = sanitizeText(req.body.name);
    if (!name) return badRequest(res, 'Name cannot be empty');
    users.rename(user.id, name);
  }
  if (req.body?.email !== undefined) {
    const email = String(req.body.email || '').trim().toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return badRequest(res, 'Invalid email');
    const clash = email ? users.byEmail(email) : null;
    if (clash && clash.id !== user.id) return badRequest(res, 'That email is already in use');
    adminDb.setEmail(user.id, email);
  }
  if (req.body?.email_verified !== undefined) {
    adminDb.setVerified(user.id, Boolean(req.body.email_verified));
  }
  if (req.body?.banned !== undefined) {
    const banned = Boolean(req.body.banned);
    adminDb.setBanned(user.id, banned, req.body?.ban_reason ? sanitizeText(req.body.ban_reason) : null);
    if (banned) adminDb.revokeSessions(user.id); // kick them out immediately
  }
  res.json({ user: userView(users.byId(user.id)) });
}));

adminRoutes.post('/users/:id/revoke-sessions', (req, res) => {
  const user = users.byId(req.params.id);
  if (!user) return notFound(res, 'User not found');
  res.json({ revoked: adminDb.revokeSessions(user.id) });
});

adminRoutes.delete('/users/:id', (req, res) => {
  const user = users.byId(req.params.id);
  if (!user) return notFound(res, 'User not found');
  const owned = adminUsers.membershipsFor(user.id).filter((m) => m.role === 'owner');
  if (owned.length && req.query.force !== '1') {
    return res.status(409).json({ error: `Owns ${owned.length} class(es)`, ownsClasses: owned.length });
  }
  for (const c of owned) classes.remove(c.id);
  adminDb.removeUser(user.id);
  res.json({ ok: true });
});

/* --------------------------------- classes -------------------------------- */

adminRoutes.get('/classes', (req, res) => {
  const q = String(req.query.q || '').trim();
  res.set('Cache-Control', 'no-store');
  res.json({ classes: adminClasses.list(q).map(classView) });
});

adminRoutes.patch('/classes/:id', wrap(async (req, res) => {
  const cls = classes.byId(req.params.id);
  if (!cls) return notFound(res, 'Class not found');

  if (req.body?.name !== undefined) {
    const name = sanitizeText(req.body.name);
    if (!name) return badRequest(res, 'Name cannot be empty');
    classes.update(cls.id, { name });
  }
  if (req.body?.post_policy !== undefined) {
    if (!['everyone', 'restricted'].includes(req.body.post_policy)) return badRequest(res, 'Invalid policy');
    classes.update(cls.id, { post_policy: req.body.post_policy });
  }
  if (req.body?.new_invite) classes.regenerateInvite(cls.id);

  if (req.body?.school !== undefined) {
    const sc = req.body.school ? schools.findOrCreate(String(req.body.school)) : null;
    schools.setClassSchool(cls.id, sc?.id ?? null);
  }

  if (req.body?.features !== undefined) {
    const merged = { ...parseFeatures(cls), ...(req.body.features || {}) };
    const upload = merged.upload_mb === null || merged.upload_mb === '' ? null : Number(merged.upload_mb);
    if (upload !== null && (!Number.isFinite(upload) || upload < 1 || upload > 500)) {
      return badRequest(res, 'upload_mb must be between 1 and 500');
    }
    adminDb.setClassFeatures(cls.id, {
      upload_mb: upload,
      read_only: Boolean(merged.read_only),
      featured: Boolean(merged.featured),
      official: Boolean(merged.official),
    });
  }

  const updated = adminClasses.list().find((c) => c.id === cls.id);
  res.json({ class: classView(updated) });
}));

adminRoutes.delete('/classes/:id', (req, res) => {
  const cls = classes.byId(req.params.id);
  if (!cls) return notFound(res, 'Class not found');
  classes.remove(cls.id);
  res.json({ ok: true });
});

/* ------------------------------ login events ------------------------------ */

adminRoutes.get('/logins', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 60));
  res.set('Cache-Control', 'no-store');
  res.json({ logins: loginEvents.recent(limit) });
});

adminRoutes.get('/features', (_req, res) => {
  res.json({ defaults: DEFAULT_FEATURES });
});

/* --------------------------------- schools -------------------------------- */

adminRoutes.get('/schools', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ schools: schools.list() });
});

adminRoutes.post('/schools', wrap(async (req, res) => {
  const name = sanitizeText(req.body?.name);
  if (!name) return badRequest(res, 'School name is required');
  if (schools.byName(name)) return badRequest(res, 'That school already exists');
  res.status(201).json({ school: schools.create({ name, domain: req.body?.domain }) });
}));

adminRoutes.patch('/schools/:id', wrap(async (req, res) => {
  const school = schools.byId(req.params.id);
  if (!school) return notFound(res, 'School not found');
  const name = req.body?.name !== undefined ? sanitizeText(req.body.name) : undefined;
  if (name !== undefined) {
    if (!name) return badRequest(res, 'School name cannot be empty');
    const clash = schools.byName(name);
    if (clash && clash.id !== school.id) return badRequest(res, 'That name is already used');
  }
  res.json({ school: schools.update(school.id, { name, domain: req.body?.domain }) });
}));

adminRoutes.delete('/schools/:id', (req, res) => {
  const school = schools.byId(req.params.id);
  if (!school) return notFound(res, 'School not found');
  schools.remove(school.id);
  res.json({ ok: true });
});
