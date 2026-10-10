import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { UPLOAD_DIR, MAX_UPLOAD_MB } from './env.js';
import {
  users, classes, members, subjects, slots, homework, attachments,
  subjectPerms, canPostFor, SUBJECT_COLORS,
} from './db.js';
import { requireAuth, requireMembership, isOwner } from './auth.js';
import { publicUser } from './oauth.js';
import { badRequest, notFound, forbidden, isDate, wrap, newId } from './util.js';
import { rateLimit } from './rateLimit.js';
import { parseImageParams, ensureThumb, dropThumbs } from './images.js';
import { sample7a } from './sample7a.js';
import { parseShkoloPdf } from './importPdf.js';

export const apiRouter = express.Router();

// Abuse guards (per client IP).
const uploadLimiter = rateLimit({ name: 'upload', windowMs: 10 * 60_000, max: 80 });
const importLimiter = rateLimit({ name: 'import', windowMs: 10 * 60_000, max: 20 });
const writeLimiter = rateLimit({ name: 'write', windowMs: 60_000, max: 60 });

/* ------------------------------- serializers ------------------------------- */

const attachmentView = (a) => ({
  id: a.id,
  name: a.original_name,
  mime: a.mime,
  size: a.size,
  url: `/api/files/${a.id}`,
});

const homeworkView = (h) => ({
  id: h.id,
  title: h.title,
  body: h.body,
  due_date: h.due_date,
  created_at: h.created_at,
  updated_at: h.updated_at,
  subject: h.subject,
  author: h.author,
  attachments: (h.attachments || []).map(attachmentView),
});

const subjectView = (s) => ({
  id: s.id,
  name: s.name,
  color: s.color,
  teacher: s.teacher,
  permitted_user_ids: subjectPerms.list(s.id),
});

const slotView = (slot, subjectMap) => {
  const subj = slot.subject_id ? subjectMap.get(slot.subject_id) : null;
  return {
    id: slot.id,
    day: slot.day,
    period: slot.period,
    subject_id: slot.subject_id,
    subject: subj?.name ?? slot.label ?? '',
    color: subj?.color ?? null,
    teacher: slot.teacher ?? subj?.teacher ?? '',
    room: slot.room ?? '',
    start: slot.start_time ?? '',
    end: slot.end_time ?? '',
  };
};

function classView(cls, role) {
  return {
    id: cls.id,
    name: cls.name,
    role,
    invite_code: cls.invite_code,
    post_policy: cls.post_policy,
    source_url: cls.source_url || null,
    created_at: cls.created_at,
    can_manage: role === 'owner',
  };
}

/* ------------------------------ shared logic ------------------------------- */

function findOrCreateSubject(classId, name) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  return subjects.byName(classId, clean) || subjects.create({ classId, name: clean });
}

/** Replace the class timetable from a list of slot drafts ({subject|subject_id,...}). */
function applySchedule(classId, list) {
  const prepared = [];
  for (const raw of list) {
    const day = Number(raw.day);
    const period = Number(raw.period);
    if (!Number.isInteger(day) || day < 1 || day > 7) continue;
    if (!Number.isInteger(period) || period < 0 || period > 12) continue;
    const subjectName = String(raw.subject ?? '').trim();
    const label = String(raw.label ?? '').trim();
    if (!subjectName && !label) continue;
    let subjectId = raw.subject_id && subjects.byId(raw.subject_id)?.id === raw.subject_id ? raw.subject_id : null;
    if (!subjectId && subjectName) subjectId = findOrCreateSubject(classId, subjectName)?.id ?? null;
    const time = (t) => (/^\d{1,2}:\d{2}$/.test(String(t || '')) ? String(t).padStart(5, '0') : null);
    prepared.push({
      day,
      period,
      subject_id: subjectId,
      label: label || null,
      teacher: String(raw.teacher ?? '').trim() || null,
      room: String(raw.room ?? '').trim() || null,
      start_time: time(raw.start ?? raw.start_time),
      end_time: time(raw.end ?? raw.end_time),
    });
  }
  slots.replace(classId, prepared);
  return prepared.length;
}

function scheduleView(classId) {
  const all = subjects.list(classId);
  const subjectMap = new Map(all.map((s) => [s.id, s]));
  return slots.list(classId).map((s) => slotView(s, subjectMap));
}

/* --------------------------------- uploads --------------------------------- */

const ALLOWED_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.avif', '.bmp',
  '.pdf', '.txt', '.md', '.csv', '.rtf',
  '.ppt', '.pptx', '.odp', '.key',
  '.doc', '.docx', '.odt', '.pages',
  '.xls', '.xlsx', '.ods', '.numbers',
  '.zip', '.mp3', '.m4a', '.mp4', '.mov', '.webm',
]);

const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
      cb(null, `${newId()}${ALLOWED_EXT.has(ext) ? ext : ''}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = ALLOWED_EXT.has(ext) || /^(image|video|audio)\//.test(file.mimetype);
    cb(ok ? null : new Error(`File type not allowed: ${file.originalname}`), ok);
  },
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(MAX_UPLOAD_MB, 40) * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname);
    cb(ok ? null : new Error('Please upload a PDF file'), ok);
  },
});

/* ---------------------------------- config --------------------------------- */

apiRouter.get('/config', (_req, res) => {
  res.json({ maxUploadMb: MAX_UPLOAD_MB, subjectColors: SUBJECT_COLORS });
});

/* ----------------------------------- me ------------------------------------ */

apiRouter.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

apiRouter.patch('/me', requireAuth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return badRequest(res, 'Name is required');
  res.json({ user: publicUser(users.rename(req.user.id, name)) });
});

/* --------------------------------- classes --------------------------------- */

apiRouter.get('/classes', requireAuth, (req, res) => {
  res.json({ classes: classes.listForUser(req.user.id).map((c) => ({ ...c, can_manage: c.role === 'owner' })) });
});

apiRouter.post('/classes', requireAuth, writeLimiter, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return badRequest(res, 'Class name is required');
  if (name.length > 60) return badRequest(res, 'Class name is too long');
  const cls = classes.create({ name, ownerId: req.user.id });
  res.status(201).json({ class: classView(cls, 'owner') });
});

apiRouter.post('/classes/join', requireAuth, (req, res) => {
  const code = String(req.body?.code || '').trim();
  if (!code) return badRequest(res, 'Invite code is required');
  const cls = classes.byInvite(code);
  if (!cls) return notFound(res, 'No class matches that invite code');
  if (!members.get(cls.id, req.user.id)) members.add(cls.id, req.user.id, 'member');
  res.json({ class: classView(cls, members.get(cls.id, req.user.id).role) });
});

apiRouter.get('/classes/:id', requireAuth, requireMembership('id'), (req, res) => {
  const subjectList = subjects.list(req.classId);
  res.json({
    class: classView(req.cls, req.membership.role),
    members: members.list(req.classId),
    subjects: subjectList.map(subjectView),
    schedule: scheduleView(req.classId),
  });
});

apiRouter.patch('/classes/:id', requireAuth, requireMembership('id'), (req, res) => {
  if (!isOwner(req)) return forbidden(res, 'Only the class owner can change settings');
  const patch = {};
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return badRequest(res, 'Class name is required');
    patch.name = name;
  }
  if (req.body?.post_policy !== undefined) {
    if (!['everyone', 'restricted'].includes(req.body.post_policy)) {
      return badRequest(res, 'Invalid post policy');
    }
    patch.post_policy = req.body.post_policy;
  }
  if (req.body?.source_url !== undefined) {
    patch.source_url = req.body.source_url ? String(req.body.source_url) : null;
  }
  const cls = classes.update(req.classId, patch);
  res.json({ class: classView(cls, req.membership.role) });
});

apiRouter.delete('/classes/:id', requireAuth, requireMembership('id'), (req, res) => {
  if (!isOwner(req)) return forbidden(res, 'Only the class owner can delete the class');
  classes.remove(req.classId);
  res.json({ ok: true });
});

apiRouter.post('/classes/:id/invite', requireAuth, requireMembership('id'), (req, res) => {
  if (!isOwner(req)) return forbidden(res, 'Only the class owner can change the invite code');
  res.json({ invite_code: classes.regenerateInvite(req.classId) });
});

apiRouter.patch('/classes/:id/members/:userId', requireAuth, requireMembership('id'), (req, res) => {
  if (!isOwner(req)) return forbidden(res, 'Only the class owner can manage members');
  const { userId } = req.params;
  const role = req.body?.role;
  if (!['owner', 'member'].includes(role)) return badRequest(res, 'Invalid role');
  if (role === 'owner') members.setRole(req.classId, req.user.id, 'member');
  members.setRole(req.classId, userId, role);
  res.json({ members: members.list(req.classId) });
});

apiRouter.delete('/classes/:id/members/:userId', requireAuth, requireMembership('id'), (req, res) => {
  const { userId } = req.params;
  const self = userId === req.user.id;
  if (!self && !isOwner(req)) return forbidden(res, 'Only the class owner can remove members');
  if (userId === req.cls.owner_id) return badRequest(res, 'The owner cannot be removed');
  members.remove(req.classId, userId);
  res.json({ members: members.list(req.classId) });
});

/* --------------------------------- subjects -------------------------------- */

apiRouter.post('/classes/:id/subjects', requireAuth, requireMembership('id'), (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return badRequest(res, 'Subject name is required');
  const existing = subjects.byName(req.classId, name);
  if (existing) return res.json({ subject: subjectView(existing) });
  const subject = subjects.create({
    classId: req.classId,
    name,
    color: req.body?.color,
    teacher: req.body?.teacher,
  });
  res.status(201).json({ subject: subjectView(subject) });
});

function subjectInClass(req, res) {
  const subject = subjects.byId(req.params.id);
  if (!subject) { notFound(res, 'Subject not found'); return null; }
  if (!members.get(subject.class_id, req.user.id)) { forbidden(res, 'Not a member'); return null; }
  return subject;
}

apiRouter.patch('/subjects/:id', requireAuth, (req, res) => {
  const subject = subjectInClass(req, res);
  if (!subject) return;
  const updated = subjects.update(subject.id, {
    name: req.body?.name !== undefined ? String(req.body.name).trim() : undefined,
    color: req.body?.color !== undefined ? req.body.color : undefined,
    teacher: req.body?.teacher !== undefined ? String(req.body.teacher) : undefined,
  });
  res.json({ subject: subjectView(updated) });
});

apiRouter.delete('/subjects/:id', requireAuth, (req, res) => {
  const subject = subjectInClass(req, res);
  if (!subject) return;
  const membership = members.get(subject.class_id, req.user.id);
  if (membership.role !== 'owner') return forbidden(res, 'Only the class owner can delete subjects');
  subjects.remove(subject.id);
  res.json({ ok: true });
});

apiRouter.put('/subjects/:id/permissions', requireAuth, (req, res) => {
  const subject = subjectInClass(req, res);
  if (!subject) return;
  const membership = members.get(subject.class_id, req.user.id);
  if (membership.role !== 'owner') return forbidden(res, 'Only the class owner can assign homework permissions');
  const valid = new Set(members.list(subject.class_id).map((m) => m.id));
  const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.filter((u) => valid.has(u)) : [];
  subjectPerms.set(subject.class_id, subject.id, userIds);
  res.json({ subject: subjectView(subjects.byId(subject.id)) });
});

/* --------------------------------- schedule -------------------------------- */

apiRouter.get('/classes/:id/schedule', requireAuth, requireMembership('id'), (req, res) => {
  res.json({ schedule: scheduleView(req.classId) });
});

apiRouter.put('/classes/:id/schedule', requireAuth, requireMembership('id'), (req, res) => {
  const list = Array.isArray(req.body?.slots) ? req.body.slots : null;
  if (!list) return badRequest(res, 'slots array is required');
  const count = applySchedule(req.classId, list.slice(0, 400));
  if (req.body?.source_url !== undefined) {
    classes.update(req.classId, { source_url: req.body.source_url ? String(req.body.source_url) : null });
  }
  res.json({
    saved: count,
    schedule: scheduleView(req.classId),
    subjects: subjects.list(req.classId).map(subjectView),
    class: classView(classes.byId(req.classId), req.membership.role),
  });
});

apiRouter.post('/classes/:id/import/sample', requireAuth, requireMembership('id'), (req, res) => {
  res.json({ draft: { name: sample7a.name, note: sample7a.note, slots: sample7a.slots } });
});

apiRouter.post('/classes/:id/import/pdf', requireAuth, requireMembership('id'), importLimiter, pdfUpload.single('file'), wrap(async (req, res) => {
  if (!req.file) return badRequest(res, 'No PDF uploaded');
  try {
    const draft = await parseShkoloPdf(req.file.buffer);
    res.json({ draft });
  } catch (err) {
    res.status(422).json({ error: `Could not read the timetable: ${err.message}` });
  }
}));

/* --------------------------------- homework -------------------------------- */

apiRouter.get('/classes/:id/homework', requireAuth, requireMembership('id'), (req, res) => {
  const { from, to, subject } = req.query;
  const list = homework.list(req.classId, {
    from: isDate(from) ? from : undefined,
    to: isDate(to) ? to : undefined,
    subjectId: typeof subject === 'string' && subject ? subject : undefined,
  });
  res.json({ homework: list.map(homeworkView) });
});

apiRouter.post('/classes/:id/homework', requireAuth, requireMembership('id'), writeLimiter, (req, res) => {
  const title = String(req.body?.title || '').trim();
  const due = String(req.body?.due_date || '');
  const subjectId = req.body?.subject_id ? String(req.body.subject_id) : null;
  if (!title) return badRequest(res, 'Title is required');
  if (!isDate(due)) return badRequest(res, 'A due date is required (YYYY-MM-DD)');
  if (subjectId) {
    const subject = subjects.byId(subjectId);
    if (!subject || subject.class_id !== req.classId) return badRequest(res, 'Unknown subject');
  }
  if (!canPostFor(req.classId, subjectId, req.user.id)) {
    return forbidden(res, 'You are not allowed to post homework for this subject');
  }
  const created = homework.create({
    classId: req.classId,
    subjectId,
    createdBy: req.user.id,
    title,
    body: req.body?.body != null ? String(req.body.body) : null,
    dueDate: due,
  });
  res.status(201).json({ homework: homeworkView(created) });
});

function homeworkForWrite(req, res) {
  const hw = homework.raw(req.params.id);
  if (!hw) { notFound(res, 'Homework not found'); return null; }
  const membership = members.get(hw.class_id, req.user.id);
  if (!membership) { forbidden(res, 'Not a member'); return null; }
  const allowed = isOwnerSynthetic(membership) || hw.created_by === req.user.id
    || canPostFor(hw.class_id, hw.subject_id, req.user.id);
  if (!allowed) { forbidden(res, 'You cannot edit this homework'); return null; }
  req.membership = membership;
  return hw;
}

const isOwnerSynthetic = (membership) => membership.role === 'owner';

apiRouter.get('/homework/:id', requireAuth, (req, res) => {
  const hw = homework.raw(req.params.id);
  if (!hw) return notFound(res, 'Homework not found');
  if (!members.get(hw.class_id, req.user.id)) return forbidden(res, 'Not a member');
  res.json({ homework: homeworkView(homework.byId(hw.id)) });
});

apiRouter.patch('/homework/:id', requireAuth, (req, res) => {
  const hw = homeworkForWrite(req, res);
  if (!hw) return;
  const patch = {};
  if (req.body?.title !== undefined) {
    const t = String(req.body.title).trim();
    if (!t) return badRequest(res, 'Title is required');
    patch.title = t;
  }
  if (req.body?.body !== undefined) patch.body = req.body.body == null ? null : String(req.body.body);
  if (req.body?.due_date !== undefined) {
    if (!isDate(req.body.due_date)) return badRequest(res, 'Invalid due date');
    patch.dueDate = req.body.due_date;
  }
  if (req.body?.subject_id !== undefined) {
    patch.subjectId = req.body.subject_id ? String(req.body.subject_id) : null;
  }
  res.json({ homework: homeworkView(homework.update(hw.id, patch)) });
});

apiRouter.delete('/homework/:id', requireAuth, (req, res) => {
  const hw = homeworkForWrite(req, res);
  if (!hw) return;
  for (const a of attachments.listByHomework(hw.id)) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, a.stored_name)); } catch { /* ignore */ }
  }
  homework.remove(hw.id);
  res.json({ ok: true });
});

apiRouter.post('/homework/:id/attachments', requireAuth, uploadLimiter, attachmentUpload.array('files', 10), (req, res) => {
  const hw = homework.raw(req.params.id);
  if (!hw) return notFound(res, 'Homework not found');
  const membership = members.get(hw.class_id, req.user.id);
  if (!membership) return forbidden(res, 'Not a member');
  const allowed = isOwnerSynthetic(membership) || hw.created_by === req.user.id
    || canPostFor(hw.class_id, hw.subject_id, req.user.id);
  if (!allowed) return forbidden(res, 'You cannot add files to this homework');
  const files = req.files || [];
  const created = files.map((f) => attachments.create({
    homeworkId: hw.id,
    storedName: f.filename,
    originalName: f.originalname,
    mime: f.mimetype,
    size: f.size,
  }));
  res.status(201).json({ attachments: created.map(attachmentView) });
});

apiRouter.delete('/attachments/:id', requireAuth, (req, res) => {
  const att = attachments.byId(req.params.id);
  if (!att) return notFound(res, 'File not found');
  const hw = homework.raw(att.homework_id);
  const membership = members.get(hw.class_id, req.user.id);
  if (!membership) return forbidden(res, 'Not a member');
  const allowed = isOwnerSynthetic(membership) || hw.created_by === req.user.id
    || canPostFor(hw.class_id, hw.subject_id, req.user.id);
  if (!allowed) return forbidden(res, 'You cannot remove this file');
  try { fs.unlinkSync(path.join(UPLOAD_DIR, att.stored_name)); } catch { /* ignore */ }
  dropThumbs(att.stored_name);
  attachments.remove(att.id);
  res.json({ ok: true });
});

apiRouter.get('/files/:id', requireAuth, wrap(async (req, res) => {
  const att = attachments.byId(req.params.id);
  if (!att) return notFound(res, 'File not found');
  const hw = homework.raw(att.homework_id);
  if (!members.get(hw.class_id, req.user.id)) return forbidden(res, 'Not a member');
  const filePath = path.join(UPLOAD_DIR, att.stored_name);
  if (!fs.existsSync(filePath)) return notFound(res, 'File is missing');

  const isImage = String(att.mime || '').startsWith('image/');
  const params = req.query.download ? null : parseImageParams(req.query);

  // Let the browser cache thumbnails aggressively (they are per-user, not public).
  res.setHeader('Cache-Control', 'private, max-age=604800, immutable');

  if (isImage && params) {
    try {
      const thumb = await ensureThumb(filePath, params);
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Vary', 'Accept');
      return fs.createReadStream(thumb).pipe(res);
    } catch (err) {
      console.warn('image resize failed, serving original:', err.message);
    }
  }

  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', att.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(att.original_name)}`);
  return fs.createReadStream(filePath).pipe(res);
}));
