import { useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, LayoutList, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button, Card, Input, revealDelay, useToast } from '../../components/ui';
import { useClassCtx } from '../class/ClassShell';
import { useImportPdf, useImportSample, useSaveSchedule } from '../../lib/hooks';
import type { Slot } from '../../lib/api';
import { m } from '../../paraglide/messages';

const emptyRow = (day: number, period = 1): Slot => ({ day, period, subject: '', teacher: '', room: '', start: '', end: '' });

const sortRows = (rows: Slot[]) => [...rows].sort((a, b) => a.day - b.day || a.period - b.period);

const dayName = (d: number) => (m as unknown as Record<string, () => string>)[`day_${d}`]();

function ReadonlyWeek({ rows }: { rows: Slot[] }) {
  const days = Array.from(new Set(rows.map((r) => r.day))).sort((a, b) => a - b);
  if (!days.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {days.map((d, i) => (
        <Card key={d} className="animate-rise overflow-hidden" style={revealDelay(i)}>
          <div className="bg-surface2 px-3 py-2 text-sm font-bold">{dayName(d)}</div>
          <ul className="divide-y divide-line">
            {sortRows(rows.filter((r) => r.day === d)).map((r, j) => (
              <li key={j} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="w-4 text-center text-[11px] text-muted tnum">{r.period}</span>
                <span className="min-w-0 flex-1 truncate">{r.subject || '—'}</span>
                <span className="text-[11px] text-muted tnum">{r.start}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/** Timetable import (Shkolo PDF / sample / manual) + inline editor. */
export function TimetableSection() {
  const { detail, classId } = useClassCtx();
  const toast = useToast();

  const [rows, setRows] = useState<Slot[] | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(detail.class.source_url);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const importPdf = useImportPdf(classId);
  const importSample = useImportSample(classId);
  const save = useSaveSchedule(classId);

  const current = useMemo<Slot[]>(
    () => detail.schedule.map((s) => ({ day: s.day, period: s.period, subject: s.subject, teacher: s.teacher, room: s.room, start: s.start, end: s.end })),
    [detail.schedule],
  );

  const editing = rows !== null;
  const subjectNames = useMemo(
    () => Array.from(new Set([...detail.subjects.map((s) => s.name), ...(rows ?? []).map((r) => r.subject).filter(Boolean)])),
    [detail.subjects, rows],
  );

  const startDraft = (list: Slot[], url: string | null, msg?: string) => {
    setRows(sortRows(list));
    setSourceUrl(url);
    if (msg) toast.push(msg, 'info');
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const { draft } = await importPdf.mutateAsync(file);
      startDraft(draft.slots, draft.sourceUrl ?? null, m.sch_imported_ok());
    } catch (e) {
      toast.push(e instanceof Error ? e.message : m.sch_import_failed(), 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const useSample = async () => {
    setBusy(true);
    try {
      const { draft } = await importSample.mutateAsync();
      startDraft(draft.slots, null, m.sch_from_sample());
    } catch (e) {
      toast.push(e instanceof Error ? e.message : m.common_error(), 'error');
    } finally {
      setBusy(false);
    }
  };

  const doSave = async () => {
    setBusy(true);
    try {
      await save.mutateAsync({ slots: rows ?? [], sourceUrl });
      toast.push(m.sch_saved(), 'success');
      setRows(null);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : m.common_error(), 'error');
    } finally {
      setBusy(false);
    }
  };

  const update = (index: number, patch: Partial<Slot>) =>
    setRows((r) => (r ? r.map((row, i) => (i === index ? { ...row, ...patch } : row)) : r));
  const remove = (index: number) => setRows((r) => (r ? r.filter((_, i) => i !== index) : r));
  const add = (day: number) =>
    setRows((r) => {
      const list = r ?? [];
      const period = Math.max(0, ...list.filter((x) => x.day === day).map((x) => x.period)) + 1;
      return sortRows([...list, emptyRow(day, period)]);
    });

  const daysInEditor = useMemo(() => {
    const list = rows ?? current;
    return Array.from({ length: Math.max(5, ...list.map((r) => r.day)) }, (_, i) => i + 1);
  }, [rows, current]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg">{m.sch_title()}</h2>
          <p className="mt-0.5 text-sm text-muted">{m.sch_subtitle()}</p>
        </div>
        {detail.class.source_url && (
          <a href={detail.class.source_url} target="_blank" rel="noreferrer">
            <Button variant="secondary" size="sm">
              <ExternalLink className="h-4 w-4" />
              {m.sch_open_shkolo()}
            </Button>
          </a>
        )}
      </div>

      {/* Import panel */}
      {!editing && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{m.sch_import_title()}</p>
              <p className="mt-1 text-sm text-muted">{m.sch_import_desc()}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
                <Button variant="primary" loading={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {busy ? m.sch_reading() : m.sch_choose_pdf()}
                </Button>
                <Button variant="secondary" onClick={useSample} disabled={busy}>
                  <Sparkles className="h-4 w-4" />
                  {m.sch_use_sample()}
                </Button>
                <Button variant="ghost" onClick={() => startDraft(current, sourceUrl)} disabled={busy}>
                  <LayoutList className="h-4 w-4" />
                  {current.length ? m.common_edit() : m.sch_manual()}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Editor */}
      {editing ? (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium text-ink">{m.sch_review_title()}</p>
              <p className="text-sm text-muted">{m.sch_review_desc()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setRows(null)} disabled={busy}>{m.common_cancel()}</Button>
              <Button variant="primary" loading={busy} onClick={doSave}>{m.sch_save_schedule()}</Button>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {daysInEditor.map((d) => {
              const rowsForDay = sortRows((rows ?? []).filter((r) => r.day === d));
              return (
                <div key={d} className="rounded-2xl border border-line bg-surface">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2">
                    <span className="text-sm font-bold">{dayName(d)}</span>
                    <Button size="sm" variant="ghost" onClick={() => add(d)}>
                      <Plus className="h-3.5 w-3.5" /> {m.sch_add_period()}
                    </Button>
                  </div>
                  {rowsForDay.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted">{m.sch_empty_day()}</p>}
                  <div className="space-y-2 p-2.5">
                    {rowsForDay.map((row) => {
                      const index = (rows ?? []).indexOf(row);
                      return (
                        <div key={index} className="rounded-xl border border-line bg-surface2/50 p-2.5">
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={0}
                              max={12}
                              value={row.period}
                              onChange={(e) => update(index, { period: Number(e.target.value) })}
                              aria-label={m.sch_period()}
                              title={m.sch_period()}
                              className="h-9 w-12 shrink-0 px-1 text-center tnum"
                            />
                            <Input
                              list="subject-options"
                              value={row.subject}
                              onChange={(e) => update(index, { subject: e.target.value })}
                              placeholder={m.sch_subject()}
                              className="h-9 min-w-0 flex-1"
                            />
                            <button
                              onClick={() => remove(index)}
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-red/10 hover:text-red"
                              aria-label={m.sch_remove_period()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Input value={row.teacher} onChange={(e) => update(index, { teacher: e.target.value })} placeholder={m.sch_teacher()} className="h-8 min-w-0" />
                            <Input value={row.room} onChange={(e) => update(index, { room: e.target.value })} placeholder={m.sch_room()} className="h-8 min-w-0" />
                            <Input type="time" value={row.start} onChange={(e) => update(index, { start: e.target.value })} className="h-8 min-w-0 tnum" />
                            <Input type="time" value={row.end} onChange={(e) => update(index, { end: e.target.value })} className="h-8 min-w-0 tnum" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <datalist id="subject-options">
            {subjectNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
      ) : current.length > 0 ? (
        <ReadonlyWeek rows={current} />
      ) : null}
    </div>
  );
}
