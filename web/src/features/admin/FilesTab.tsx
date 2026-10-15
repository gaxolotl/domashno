// Admin "Files" tab — a Windows-Explorer-style manager for the private file
// area (server: server/src/cdn.js). Browse folders, upload (button or drag &
// drop), preview, rename, download and delete.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp, Copy, Download, FileArchive, FileAudio, FileCode, FileImage, FileText, FileVideo,
  File as FileIcon, Folder, FolderPlus, Globe, Home, Loader2, Lock, Pencil, RefreshCw, Trash2, UploadCloud,
} from 'lucide-react';
import { Button, Card, Field, Input, Modal, Skeleton, cn, useToast } from '../../components/ui';
import { api, type CdnEntry } from '../../lib/api';
import { humanSize } from '../../lib/dates';
import { getLocale } from '../../paraglide/runtime';
import { m } from '../../paraglide/messages';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${new Intl.DateTimeFormat(getLocale() === 'bg' ? 'bg-BG' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Icon + colour per file kind, from the extension (Explorer-like). */
function iconFor(entry: CdnEntry) {
  if (entry.dir) return { Icon: Folder, className: 'text-amber-600' };
  const ext = entry.name.includes('.') ? entry.name.split('.').pop()!.toLowerCase() : '';
  const mime = entry.mime || '';
  if (mime.startsWith('image/')) return { Icon: FileImage, className: 'text-primary' };
  if (mime.startsWith('video/')) return { Icon: FileVideo, className: 'text-blue' };
  if (mime.startsWith('audio/')) return { Icon: FileAudio, className: 'text-blue' };
  if (mime === 'application/pdf') return { Icon: FileText, className: 'text-red' };
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) return { Icon: FileArchive, className: 'text-muted' };
  if (['html', 'htm', 'css', 'js', 'ts', 'tsx', 'jsx', 'json', 'xml', 'yml', 'yaml', 'py', 'sh', 'sql'].includes(ext)) {
    return { Icon: FileCode, className: 'text-muted' };
  }
  if (mime.startsWith('text/')) return { Icon: FileText, className: 'text-muted' };
  return { Icon: FileIcon, className: 'text-muted' };
}

const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

export default function FilesTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const [path, setPath] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<CdnEntry | null>(null);
  const [preview, setPreview] = useState<CdnEntry | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'files', path],
    queryFn: () => api.adminFiles(path),
    placeholderData: (prev) => prev,
  });

  useEffect(() => setSelected([]), [path]);

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['admin', 'files'] });
  }, [qc]);

  const upload = useMutation({
    mutationFn: (files: File[]) => api.adminUpload(path, files),
    onSuccess: (r) => { refresh(); toast.push(m.files_uploaded({ n: String(r.uploaded.length) }), 'success'); },
    onError: (e: Error) => toast.push(e.message, 'error'),
  });

  const del = useMutation({
    mutationFn: (paths: string[]) => Promise.all(paths.map((p) => api.adminDeleteFile(p))),
    onSuccess: () => { refresh(); setSelected([]); toast.push(m.files_deleted(), 'success'); },
    onError: (e: Error) => toast.push(e.message, 'error'),
  });

  // Share/unshare a path (a folder shares everything inside it).
  const share = useMutation({
    mutationFn: ({ rel, isPublic }: { rel: string; isPublic: boolean }) => api.adminShare(rel, isPublic),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.push(e.message, 'error'),
  });
  const shareMany = useMutation({
    mutationFn: ({ rels, isPublic }: { rels: string[]; isPublic: boolean }) =>
      Promise.all(rels.map((rel) => api.adminShare(rel, isPublic))),
    onSuccess: () => { setSelected([]); refresh(); },
    onError: (e: Error) => toast.push(e.message, 'error'),
  });

  /** Copy the link that matches the item's state: public URL if shared, else the admin URL. */
  const copyLink = (e: CdnEntry) => {
    const rel = join(path, e.name);
    const shared = Boolean(e.public || e.viaParent);
    const url = `${location.origin}${shared ? api.publicUrl(rel) : api.cdnUrl(rel)}`;
    navigator.clipboard?.writeText(url);
    toast.push(shared ? m.files_copied_public() : m.files_copied_private(), 'success');
  };

  const entries = data?.entries ?? [];
  const parent = data?.parent ?? '';
  const crumbs = path ? path.split('/') : [];

  const allSelected = entries.length > 0 && selected.length === entries.length;
  const toggleAll = () => setSelected(allSelected ? [] : entries.map((e) => e.name));
  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const openEntry = (e: CdnEntry) => {
    if (e.dir) setPath(join(path, e.name));
    else setPreview(e);
  };

  const pickFiles = (files: FileList | null) => {
    if (!files?.length) return;
    upload.mutate(Array.from(files));
  };

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    setDrag(false);
    pickFiles(ev.dataTransfer.files);
  };

  const incoming = useMemo(
    () => selected.map((n) => join(path, n)),
    [selected, path],
  );

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-2 p-2.5">
        <Button size="sm" variant="ghost" onClick={() => setPath(parent)} disabled={!path} aria-label={m.common_back()} title={m.common_back()}>
          <ArrowUp className="h-4 w-4" />
        </Button>

        {/* Breadcrumb */}
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm" aria-label={m.files_col_name()}>
          <button
            onClick={() => setPath('')}
            className={cn('inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface2', !path && 'font-semibold text-ink')}
          >
            <Home className="h-3.5 w-3.5 text-muted" />
            {m.files_root()}
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex shrink-0 items-center">
              <span className="px-1 text-muted">/</span>
              <button
                onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))}
                className={cn('rounded-lg px-2 py-1 hover:bg-surface2', i === crumbs.length - 1 && 'font-semibold text-ink')}
              >
                {c}
              </button>
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={refresh} aria-label={m.common_retry()} title={m.common_retry()}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setNewFolder(true)}>
            <FolderPlus className="h-4 w-4" />
            <span className="hidden sm:inline">{m.files_new_folder()}</span>
          </Button>
          <Button size="sm" variant="primary" loading={upload.isPending} onClick={() => fileInput.current?.click()}>
            <UploadCloud className="h-4 w-4" />
            {m.files_upload()}
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      </Card>

      {/* Selection bar */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2 text-sm">
          <span className="font-medium text-ink">{m.files_selected({ n: String(selected.length) })}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={shareMany.isPending}
              onClick={() => shareMany.mutate({ rels: incoming, isPublic: true })}
            >
              <Globe className="h-3.5 w-3.5" />
              {m.files_make_public()}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={shareMany.isPending}
              onClick={() => shareMany.mutate({ rels: incoming, isPublic: false })}
            >
              <Lock className="h-3.5 w-3.5" />
              {m.files_make_private()}
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={del.isPending}
              onClick={() => { if (confirm(m.files_delete_selected_confirm({ n: String(selected.length) }))) del.mutate(incoming); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {m.files_delete_selected()}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>{m.common_cancel()}</Button>
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn('relative rounded-2xl', drag && 'ring-2 ring-primary/50')}
      >
        {drag && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-primary-soft/60">
            <div className="text-center">
              <UploadCloud className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-1 text-sm font-medium text-primary">{m.files_drop()}</p>
            </div>
          </div>
        )}

        <Card className="overflow-hidden">
          {/* Header row */}
          <div className="flex items-center gap-3 border-b border-line bg-surface2 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 shrink-0 accent-[var(--primary)]"
              aria-label={m.files_col_name()}
            />
            <span className="min-w-0 flex-1">{m.files_col_name()}</span>
            <span className="hidden w-24 text-right sm:block">{m.files_col_size()}</span>
            <span className="hidden w-36 text-right md:block">{m.files_col_modified()}</span>
            <span className="w-[100px] shrink-0 sm:w-[168px]" />
          </div>

          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <UploadCloud className="mx-auto h-7 w-7 text-muted/70" />
              <p className="mt-2 text-sm text-muted">{m.files_empty()}</p>
              <p className="mt-1 text-xs text-muted">{m.files_drop_hint()}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {entries.map((e) => {
                const { Icon, className } = iconFor(e);
                const rel = join(path, e.name);
                const isSel = selected.includes(e.name);
                return (
                  <li
                    key={e.name}
                    className={cn('group flex items-center gap-3 px-3 py-2 transition-colors', isSel ? 'bg-primary-soft/50' : 'hover:bg-surface2')}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(e.name)}
                      className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                      aria-label={e.name}
                    />
                    <button
                      onClick={() => openEntry(e)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      title={e.dir ? m.files_open() : m.files_preview()}
                    >
                      <Icon className={cn('h-5 w-5 shrink-0', className)} />
                      <span className="min-w-0 truncate text-sm text-ink">{e.name}</span>
                      {e.dir && <span className="shrink-0 text-xs text-muted">{m.files_folder()}</span>}
                    </button>
                    <span className="hidden w-24 text-right text-xs text-muted tnum sm:block">
                      {e.dir ? '—' : humanSize(e.size ?? 0)}
                    </span>
                    <span className="hidden w-36 text-right text-xs text-muted tnum md:block">{fmtDate(e.modified)}</span>

                    <div className="flex w-[100px] shrink-0 items-center justify-end gap-0.5 sm:w-[168px]">
                      {!e.dir && (
                        <>
                          <button
                            onClick={() => copyLink(e)}
                            className="hidden h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink sm:grid"
                            aria-label={e.public || e.viaParent ? m.files_public_title() : m.files_copy_link()}
                            title={e.public || e.viaParent ? m.files_public_title() : m.files_copy_link()}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <a
                            href={api.cdnUrl(rel, true)}
                            className="hidden h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink sm:grid"
                            aria-label={m.files_download()}
                            title={m.files_download()}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </>
                      )}
                      <button
                        onClick={() => share.mutate({ rel, isPublic: !e.public })}
                        className={cn(
                          'grid h-8 w-8 place-items-center rounded-lg hover:bg-surface2',
                          e.public ? 'text-primary' : e.viaParent ? 'text-primary/60' : 'text-muted hover:text-ink',
                        )}
                        aria-label={e.public ? m.files_make_private() : m.files_make_public()}
                        title={e.public ? m.files_make_private() : e.viaParent ? m.files_public_via_parent() : m.files_make_public()}
                      >
                        {e.public || e.viaParent ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setRenaming(e)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink"
                        aria-label={m.files_rename()}
                        title={m.files_rename()}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          const msg = e.dir ? m.files_delete_dir_confirm({ name: e.name }) : m.files_delete_confirm({ name: e.name });
                          if (confirm(msg)) del.mutate([rel]);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red/10 hover:text-red"
                        aria-label={m.common_delete()}
                        title={m.common_delete()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-xs text-muted">
        {m.files_intro()}
        {entries.length > 0 && ` · ${m.files_items({ n: String(entries.length) })}`}
      </p>
      <p className="text-xs text-muted">{m.files_share_hint()}</p>

      {renaming && (
        <RenameModal
          entry={renaming}
          onClose={() => setRenaming(null)}
          onDone={() => { setRenaming(null); refresh(); toast.push(m.files_renamed(), 'success'); }}
          onError={(msg) => toast.push(msg, 'error')}
          path={path}
        />
      )}

      {newFolder && (
        <NewFolderModal
          path={path}
          onClose={() => setNewFolder(false)}
          onDone={() => { setNewFolder(false); refresh(); toast.push(m.files_folder_created(), 'success'); }}
          onError={(msg) => toast.push(msg, 'error')}
        />
      )}

      {preview && (
        <PreviewModal
          entry={preview}
          path={path}
          shared={Boolean(preview.public || preview.viaParent)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

/* --------------------------------- modals --------------------------------- */

function RenameModal({
  entry, path, onClose, onDone, onError,
}: { entry: CdnEntry; path: string; onClose: () => void; onDone: () => void; onError: (msg: string) => void }) {
  const [name, setName] = useState(entry.name);
  const rename = useMutation({
    mutationFn: () => api.adminRename(join(path, entry.name), { name: name.trim() }),
    onSuccess: onDone,
    onError: (e: Error) => onError(e.message === 'exists' ? m.files_name_exists() : e.message),
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={m.files_rename()}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{m.common_cancel()}</Button>
          <Button
            variant="primary"
            loading={rename.isPending}
            disabled={!name.trim()}
            onClick={() => rename.mutate()}
          >
            {m.common_save()}
          </Button>
        </div>
      }
    >
      <Field label={m.files_col_name()}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

function NewFolderModal({
  path, onClose, onDone, onError,
}: { path: string; onClose: () => void; onDone: () => void; onError: (msg: string) => void }) {
  const [name, setName] = useState('');
  const mkdir = useMutation({
    mutationFn: () => api.adminMkdir(path, name.trim()),
    onSuccess: onDone,
    onError: (e: Error) => onError(e.message === 'exists' ? m.files_name_exists() : e.message),
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={m.files_new_folder()}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{m.common_cancel()}</Button>
          <Button variant="primary" loading={mkdir.isPending} disabled={!name.trim()} onClick={() => mkdir.mutate()}>
            {m.common_save()}
          </Button>
        </div>
      }
    >
      <Field label={m.files_folder_name()}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

function PreviewModal({ entry, path, shared, onClose }: { entry: CdnEntry; path: string; shared: boolean; onClose: () => void }) {
  const url = api.cdnUrl(join(path, entry.name));
  const publicHref = api.publicUrl(join(path, entry.name));
  const mime = entry.mime || '';
  const ext = entry.name.includes('.') ? entry.name.split('.').pop()!.toLowerCase() : '';
  const text = mime.startsWith('text/plain') && ['txt', 'md', 'csv', 'json'].includes(ext);
  const [body, setBody] = useState<string | null>(null);

  useEffect(() => {
    if (!text) return;
    let alive = true;
    fetch(url, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => { if (alive) setBody(t.slice(0, 20000)); })
      .catch(() => { if (alive) setBody(null); });
    return () => { alive = false; };
  }, [url, text]);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={entry.name}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted tnum">{entry.size != null ? humanSize(entry.size) : ''} · {fmtDate(entry.modified)}</span>
          <div className="flex flex-wrap items-center gap-2">
            {shared && (
              <Button
                variant="secondary"
                onClick={() => { navigator.clipboard?.writeText(`${location.origin}${publicHref}`); }}
              >
                <Globe className="h-4 w-4" />
                {m.files_copy_link()}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>{m.common_close()}</Button>
            <a href={api.cdnUrl(join(path, entry.name), true)}>
              <Button variant="primary"><Download className="h-4 w-4" />{m.files_download()}</Button>
            </a>
          </div>
        </div>
      }
    >
      <div className="grid min-h-40 place-items-center">
        {mime.startsWith('image/') ? (
          <img src={url} alt={entry.name} className="max-h-[65dvh] w-auto rounded-xl border border-line" />
        ) : mime.startsWith('video/') ? (
          <video src={url} controls className="max-h-[65dvh] w-full rounded-xl border border-line" />
        ) : mime.startsWith('audio/') ? (
          <audio src={url} controls className="w-full" />
        ) : mime === 'application/pdf' ? (
          <iframe src={url} title={entry.name} className="h-[65dvh] w-full rounded-xl border border-line" />
        ) : text ? (
          body === null
            ? <Loader2 className="h-5 w-5 animate-spin text-muted" />
            : <pre className="max-h-[65dvh] w-full overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface2 p-3 text-xs text-ink">{body}</pre>
        ) : (
          <div className="text-center">
            <FileIcon className="mx-auto h-7 w-7 text-muted/70" />
            <p className="mt-2 text-sm text-muted">{m.files_no_preview()}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
