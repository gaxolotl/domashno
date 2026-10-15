// Private file area ("private CDN") for the admin panel — a Windows-Explorer
// style manager backed by real directories on disk.
//
// Layout: DATA_DIR/cdn/<folders…>/<files…>
//
// Admin (all require ADMIN_EMAIL; see auth.requireAdmin):
//   GET    /api/admin/files?path=…          list one folder
//   POST   /api/admin/files?path=…          upload files (multipart "files")
//   POST   /api/admin/folders               create a folder
//   PATCH  /api/admin/files                 rename / move  { path, name|to }
//   DELETE /api/admin/files?path=…          delete a file or folder (recursive)
//   POST   /api/admin/files/public          share / unshare  { path, public }
//   GET    /api/admin/files/raw?path=…      stream a file (admin-only)
//
// Public (no sign-in — only paths explicitly shared, or inside a shared folder):
//   GET    /api/cdn/f/*path                 stream a shared file
//   GET    /api/cdn/ls/*path                list a shared folder (JSON)
//
// Paths are always resolved relative to CDN_ROOT and verified to stay inside
// it, so `..`, absolute paths and symlink tricks cannot escape the root.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { DATA_DIR, MAX_CDN_MB } from './env.js';
import { requireAdmin } from './auth.js';
import { cdnPublic } from './db.js';
import { badRequest, notFound, wrap } from './util.js';

export const CDN_ROOT = path.join(DATA_DIR, 'cdn');
fs.mkdirSync(CDN_ROOT, { recursive: true });

export const cdnRoutes = express.Router();
export const publicCdnRoutes = express.Router();

/* ------------------------------- path safety ------------------------------- */

/** Turn a client path into a normalised, root-relative path. Null = invalid. */
function normRel(input) {
  const raw = String(input ?? '').replace(/\\/g, '/');
  const parts = [];
  for (const seg of raw.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') return null; // never allow escaping
    parts.push(seg);
  }
  return parts.join('/');
}

/**
 * Resolve a client path to an absolute path inside CDN_ROOT.
 * Returns null when the path is invalid or would escape the root.
 * Uses realpath on the deepest existing ancestor so symlinks cannot escape.
 */
function resolve(rel) {
  if (rel === null) return null;
  const abs = path.resolve(CDN_ROOT, rel);
  if (abs !== CDN_ROOT && !abs.startsWith(CDN_ROOT + path.sep)) return null;
  let probe = abs;
  while (probe !== CDN_ROOT) {
    try {
      const real = fs.realpathSync(probe);
      if (real !== CDN_ROOT && !real.startsWith(CDN_ROOT + path.sep)) return null;
      return abs; // deepest existing ancestor checked out
    } catch {
      probe = path.dirname(probe); // doesn't exist yet — walk up
    }
  }
  return abs;
}

/** A single path segment (name), safe for on-disk use. */
function safeName(input) {
  const name = String(input ?? '')
    .replace(/[/\\:*?"<>|]/g, '') // path separators + chars Windows/HTTP dislike
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/^\.+/, '') // no leading dots (., .., hidden)
    .trim()
    .slice(0, 120);
  return name || null;
}

/** Pick a free name in `dir` (Windows-style "file (1).ext"). */
function uniquePath(dir, name) {
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  let candidate = name;
  for (let i = 1; fs.existsSync(path.join(dir, candidate)); i++) {
    candidate = `${stem} (${i})${ext}`;
    if (i > 9999) return null;
  }
  return candidate;
}

/* ----------------------------- public sharing ----------------------------- */

const parentOf = (rel) => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');

/** Is `rel` shared (itself, or any ancestor folder)? */
function isPublic(rel, publicSet) {
  if (!rel) return false;
  const segs = rel.split('/');
  for (let i = 1; i <= segs.length; i++) {
    if (publicSet.has(segs.slice(0, i).join('/'))) return true;
  }
  return false;
}

/** Public URL for a path (path segments encoded, slashes kept). */
export const publicUrl = (rel) => `/api/cdn/f/${rel.split('/').map(encodeURIComponent).join('/')}`;

/* ---------------------------------- mime ---------------------------------- */

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
  svg: 'image/svg+xml', pdf: 'application/pdf', txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8', json: 'application/json',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg',
  zip: 'application/zip', '7z': 'application/x-7z-compressed', rar: 'application/vnd.rar',
  gz: 'application/gzip', tar: 'application/x-tar',
};
const mimeFor = (name) => MIME[path.extname(name).slice(1).toLowerCase()] || 'application/octet-stream';

/**
 * Types safe to render inline in a browser. Everything else is sent as a
 * download with `nosniff`, so an uploaded .html/.svg can never execute script
 * in the app's origin (stored XSS).
 */
function inlineType(mime) {
  if (mime === 'application/pdf') return 'application/pdf';
  if (/^image\/(png|jpeg|gif|webp|avif|bmp|x-icon)$/.test(mime)) return mime;
  if (/^(video|audio)\//.test(mime)) return mime;
  if (mime.startsWith('text/plain')) return 'text/plain; charset=utf-8';
  return null;
}

/** Stream a stored file. `cache` differs between admin (private) and public. */
function streamFile(req, res, abs, { cache }) {
  const name = path.basename(abs);
  const mime = mimeFor(name);
  const inline = req.query.download ? null : inlineType(mime);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', cache);
  res.setHeader('Content-Type', inline || 'application/octet-stream');
  const disposition = inline ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`);
  return fs.createReadStream(abs).pipe(res); // streams, so the size is set by Node
}

/* --------------------------------- listing -------------------------------- */

const entryView = (abs, name) => {
  const st = fs.statSync(abs);
  const isDir = st.isDirectory();
  return {
    name,
    dir: isDir,
    size: isDir ? null : st.size,
    mime: isDir ? null : mimeFor(name),
    modified: st.mtime.toISOString(),
  };
};

function readEntries(abs) {
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter((d) => !d.name.startsWith('.'))
    .map((d) => {
      try {
        return entryView(path.join(abs, d.name), d.name);
      } catch {
        return null; // broken symlink etc.
      }
    })
    .filter(Boolean);
}

/* ============================ admin (authenticated) ======================== */

cdnRoutes.use(requireAdmin);

cdnRoutes.get('/files', wrap(async (req, res) => {
  const rel = normRel(req.query.path);
  const abs = resolve(rel);
  if (abs === null) return badRequest(res, 'Invalid path');
  let st;
  try {
    st = await fsp.stat(abs);
  } catch {
    return notFound(res, 'Folder not found');
  }
  if (!st.isDirectory()) return badRequest(res, 'Not a folder');

  const shared = new Set(cdnPublic.list());
  const parent = parentOf(rel);
  const folderShared = isPublic(rel, shared);

  const entries = readEntries(abs).map((e) => {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    const explicit = shared.has(childRel);
    return {
      ...e,
      public: explicit,
      // Reachable through a shared parent folder (but not shared itself).
      viaParent: !explicit && folderShared,
      url: isPublic(childRel, shared) && !e.dir ? publicUrl(childRel) : null,
    };
  });

  res.set('Cache-Control', 'no-store');
  res.json({ path: rel, parent, shared: folderShared, entries });
}));

/* --------------------------------- uploads -------------------------------- */

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => cb(null, req.cdnDir), // set by targetDir
    filename: (req, file, cb) => {
      const safe = safeName(path.basename(file.originalname)) || 'file';
      cb(null, uniquePath(req.cdnDir, safe) || `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: MAX_CDN_MB * 1024 * 1024, files: 30 },
});

/** Validate ?path= and stash the resolved directory before multer writes. */
function targetDir(req, res, next) {
  const rel = normRel(req.query.path);
  const abs = resolve(rel);
  if (abs === null) return badRequest(res, 'Invalid path');
  try {
    if (!fs.statSync(abs).isDirectory()) return badRequest(res, 'Not a folder');
  } catch {
    return notFound(res, 'Folder not found');
  }
  req.cdnDir = abs;
  next();
}

cdnRoutes.post('/files', targetDir, upload.array('files', 30), (req, res) => {
  const files = req.files || [];
  if (!files.length) return badRequest(res, 'No files uploaded');
  res.status(201).json({ uploaded: files.map((f) => ({ name: f.filename, size: f.size })) });
});

/* --------------------------------- folders -------------------------------- */

cdnRoutes.post('/folders', wrap(async (req, res) => {
  const rel = normRel(req.body?.path);
  const abs = resolve(rel);
  if (abs === null) return badRequest(res, 'Invalid path');
  const name = safeName(req.body?.name);
  if (!name) return badRequest(res, 'Folder name is required');
  const dir = path.join(abs, name);
  if (fs.existsSync(dir)) return res.status(409).json({ error: 'exists' });
  await fsp.mkdir(dir, { recursive: false });
  res.status(201).json({ name });
}));

/* ---------------------------- rename / move ------------------------------- */

cdnRoutes.patch('/files', wrap(async (req, res) => {
  const fromRel = normRel(req.body?.path);
  const from = resolve(fromRel);
  if (from === null || fromRel === '') return badRequest(res, 'Invalid path');
  if (!fs.existsSync(from)) return notFound(res, 'Not found');

  // `name` renames in place; `to` moves to another folder in the tree.
  let toRel = fromRel;
  if (req.body?.to !== undefined) {
    const parent = normRel(req.body.to);
    if (parent === null) return badRequest(res, 'Invalid path');
    const parentAbs = resolve(parent);
    if (parentAbs === null || !fs.existsSync(parentAbs) || !fs.statSync(parentAbs).isDirectory()) {
      return badRequest(res, 'Target folder not found');
    }
    toRel = parent ? `${parent}/${path.basename(from)}` : path.basename(from);
  }
  if (req.body?.name !== undefined) {
    const name = safeName(req.body.name);
    if (!name) return badRequest(res, 'Name is required');
    const parentRel = parentOf(toRel);
    toRel = parentRel ? `${parentRel}/${name}` : name;
  }
  if (toRel === fromRel) return res.json({ path: toRel, unchanged: true });

  const to = resolve(toRel);
  if (to === null) return badRequest(res, 'Invalid path');
  if (fs.existsSync(to)) return res.status(409).json({ error: 'exists' });
  if (to.startsWith(from + path.sep)) return badRequest(res, 'Cannot move a folder into itself');

  await fsp.rename(from, to);
  cdnPublic.renameTree(fromRel, toRel); // keep shares attached to the files
  res.json({ path: toRel });
}));

/* --------------------------------- delete --------------------------------- */

cdnRoutes.delete('/files', wrap(async (req, res) => {
  const rel = normRel(req.query.path);
  const abs = resolve(rel);
  if (abs === null || rel === '') return badRequest(res, 'Invalid path');
  let st;
  try {
    st = await fsp.lstat(abs);
  } catch {
    return notFound(res, 'Not found');
  }
  if (st.isDirectory()) await fsp.rm(abs, { recursive: true, force: true });
  else await fsp.unlink(abs);
  cdnPublic.removeTree(rel);
  res.json({ ok: true });
}));

/* ------------------------------ share/unshare ----------------------------- */

cdnRoutes.post('/files/public', (req, res) => {
  const rel = normRel(req.body?.path);
  if (rel === null || rel === '') return badRequest(res, 'Invalid path');
  const abs = resolve(rel);
  if (abs === null || !fs.existsSync(abs)) return notFound(res, 'Not found');
  if (req.body?.public) cdnPublic.set(rel);
  else cdnPublic.clear(rel);
  const shared = new Set(cdnPublic.list());
  res.json({ path: rel, public: cdnPublic.list().includes(rel), url: isPublic(rel, shared) && !fs.statSync(abs).isDirectory() ? publicUrl(rel) : null });
});

/* ------------------------ serve a file (admin only) ----------------------- */

cdnRoutes.get('/files/raw', wrap(async (req, res) => {
  const rel = normRel(req.query.path);
  const abs = resolve(rel);
  if (abs === null || rel === '') return badRequest(res, 'Invalid path');
  let st;
  try {
    st = await fsp.stat(abs);
  } catch {
    return notFound(res, 'File not found');
  }
  if (st.isDirectory()) return badRequest(res, 'Not a file');
  return streamFile(req, res, abs, { cache: 'private, max-age=0, must-revalidate' });
}));

/* ============================= public (no auth) ============================ */

/** `*` captures the path (Express 4 puts it in params[0]). */
const wildcardPath = (req) => normRel(req.params[0]);

publicCdnRoutes.get('/f/*', wrap(async (req, res) => {
  const rel = wildcardPath(req);
  const abs = resolve(rel);
  if (abs === null || !rel) return notFound(res, 'Not found');
  // 404 (not 403) for anything not shared — don't reveal that it exists.
  if (!isPublic(rel, new Set(cdnPublic.list()))) return notFound(res, 'Not found');
  let st;
  try {
    st = await fsp.stat(abs);
  } catch {
    return notFound(res, 'Not found');
  }
  if (st.isDirectory()) return notFound(res, 'Not found');
  return streamFile(req, res, abs, { cache: 'public, max-age=300, must-revalidate' });
}));

publicCdnRoutes.get('/ls/*', wrap(async (req, res) => {
  const rel = wildcardPath(req);
  const abs = resolve(rel);
  if (abs === null) return notFound(res, 'Not found');
  const shared = new Set(cdnPublic.list());
  if (!isPublic(rel, shared)) return notFound(res, 'Not found');
  let st;
  try {
    st = await fsp.stat(abs);
  } catch {
    return notFound(res, 'Not found');
  }
  if (!st.isDirectory()) return notFound(res, 'Not found');

  const entries = readEntries(abs)
    .map((e) => {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      return isPublic(childRel, shared)
        ? { ...e, url: e.dir ? null : publicUrl(childRel) }
        : null;
    })
    .filter(Boolean);

  res.set('Cache-Control', 'public, max-age=60');
  res.json({ path: rel, entries });
}));
