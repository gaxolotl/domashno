import { useEffect, useRef, useState } from 'react';
import { Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { Button, Field, Input, Modal, Select, Textarea, cn, useToast } from '../../components/ui';
import { api, ApiError, type Attachment, type Homework, type Subject } from '../../lib/api';
import { todayISO, humanSize } from '../../lib/dates';
import { m } from '../../paraglide/messages';

export function AttachmentGrid({ items, onDelete }: { items: Attachment[]; onDelete?: (a: Attachment) => void }) {
  if (!items.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((a) => {
        const isImage = (a.mime || '').startsWith('image/');
        return (
          <li key={a.id} className="group relative overflow-hidden rounded-xl border border-line bg-surface2">
            <a href={a.url} target="_blank" rel="noreferrer" className="block">
              {isImage ? (
                <img src={a.url} alt={a.name} className="h-28 w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-28 flex-col items-center justify-center gap-2 px-2 text-center">
                  <Paperclip className="h-5 w-5 text-muted" />
                  <span className="line-clamp-2 text-xs text-muted">{a.name}</span>
                </div>
              )}
            </a>
            <div className="flex items-center justify-between gap-1 border-t border-line px-2 py-1.5">
              <span className="truncate text-[11px] text-muted">{humanSize(a.size)}</span>
              <a href={`${a.url}?download=1`} className="text-[11px] font-medium text-primary hover:underline">
                {m.hw_download()}
              </a>
            </div>
            {onDelete && (
              <button
                onClick={() => onDelete(a)}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-ink/60 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus:opacity-100"
                aria-label={m.common_delete()}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function useFilePicker(onFiles: (files: File[]) => void, maxMb: number, tooBig: (msg: string) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const handle = (files: FileList | null) => {
    if (!files?.length) return;
    const arr = Array.from(files);
    const big = arr.find((f) => f.size > maxMb * 1024 * 1024);
    if (big) return tooBig(m.hw_file_too_big({ mb: String(maxMb) }));
    onFiles(arr);
  };
  return {
    ref,
    drag,
    open: () => ref.current?.click(),
    input: (
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        onChange={(e) => { handle(e.target.files); e.target.value = ''; }}
      />
    ),
    dropProps: {
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDrag(true); },
      onDragLeave: () => setDrag(false),
      onDrop: (e: React.DragEvent) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); },
    },
  };
}

export function HomeworkEditor({
  open,
  onClose,
  classId,
  subjects,
  editing,
  defaultDate,
  defaultSubjectId,
  canPost,
  maxMb,
}: {
  open: boolean;
  onClose: () => void;
  classId: string;
  subjects: Subject[];
  editing?: Homework | null;
  defaultDate?: string;
  defaultSubjectId?: string | null;
  canPost: (subjectId: string | null) => boolean;
  maxMb: number;
}) {
  const toast = useToast();
  const [subjectId, setSubjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [due, setDue] = useState(defaultDate || todayISO());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSubjectId(editing?.subject?.id ?? defaultSubjectId ?? '');
    setTitle(editing?.title ?? '');
    setBody(editing?.body ?? '');
    setDue(editing?.due_date ?? defaultDate ?? todayISO());
    setAttachments(editing?.attachments ?? []);
    setPending([]);
    setError('');
  }, [open, editing, defaultDate, defaultSubjectId]);

  const picker = useFilePicker(async (files) => {
    if (editing) {
      setBusy(true);
      try {
        const { attachments: added } = await api.uploadFiles(editing.id, files);
        setAttachments((a) => [...a, ...added]);
      } catch (e) {
        toast.push(e instanceof Error ? e.message : m.common_error(), 'error');
      } finally {
        setBusy(false);
      }
    } else {
      setPending((p) => [...p, ...files]);
    }
  }, maxMb, (msg) => toast.push(msg, 'error'));

  const save = async () => {
    if (!title.trim()) return setError(m.common_required());
    if (!canPost(subjectId || null) && !editing) return setError(m.hw_no_permission());
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await api.updateHomework(editing.id, {
          subject_id: subjectId || null,
          title: title.trim(),
          body: body.trim(),
          due_date: due,
        });
        toast.push(m.hw_saved(), 'success');
      } else {
        const { homework } = await api.createHomework(classId, {
          subject_id: subjectId || null,
          title: title.trim(),
          body: body.trim(),
          due_date: due,
        });
        if (pending.length) await api.uploadFiles(homework.id, pending);
        toast.push(m.hw_created(), 'success');
      }
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : m.common_error());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={editing ? m.hw_edit() : m.hw_new()}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{m.common_cancel()}</Button>
          <Button variant="primary" loading={busy} onClick={save}>{m.common_save()}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={m.hw_subject()}>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">{m.hw_subject_none()}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={m.hw_due()}>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>

        <Field label={m.hw_title_label()}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={m.hw_title_ph()} autoFocus />
        </Field>

        <Field label={m.hw_body()}>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={m.hw_body_ph()} />
        </Field>

        <div className="space-y-2">
          <span className="text-sm font-medium text-muted">{m.hw_files()}</span>
          <div
            {...picker.dropProps}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-center transition-colors',
              picker.drag && 'border-primary bg-primary-soft/50',
            )}
            onClick={picker.open}
          >
            <UploadCloud className="h-5 w-5 text-muted" />
            <span className="text-sm text-ink">{m.hw_drop()}</span>
            <span className="text-xs text-muted">{m.hw_drop_hint()}</span>
          </div>
          {picker.input}

          {attachments.length > 0 && (
            <AttachmentGrid
              items={attachments}
              onDelete={async (a) => {
                try {
                  await api.deleteAttachment(a.id);
                  setAttachments((list) => list.filter((x) => x.id !== a.id));
                } catch (e) {
                  toast.push(e instanceof Error ? e.message : m.common_error(), 'error');
                }
              }}
            />
          )}

          {pending.length > 0 && (
            <ul className="space-y-1">
              {pending.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-line bg-surface2 px-3 py-1.5 text-sm">
                  <Paperclip className="h-3.5 w-3.5 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted">{humanSize(f.size)}</span>
                  <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))} className="text-muted hover:text-red" aria-label={m.common_delete()}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {busy && <p className="text-xs text-muted">{m.hw_uploading()}</p>}
        </div>

        {error && <p className="text-sm text-red">{error}</p>}
      </div>
    </Modal>
  );
}
