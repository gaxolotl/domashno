import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { Button, Modal, cn } from '../../components/ui';
import type { Slot } from '../../lib/api';
import { addDays, formatDayMonth, formatFullDate, isoWeekday, parseISO, todayISO } from '../../lib/dates';
import {
  formatLessonTime, isWeekend, lessonsOn, monthGrid, monthLabel, nextLessonDate, weekdayHeaders,
} from '../../lib/timetable';
import { getLocale } from '../../paraglide/runtime';
import { m } from '../../paraglide/messages';

export interface DueValue {
  date: string;
  period: number | null;
}

export function DueDatePicker({
  schedule,
  subjectId,
  subjectName,
  value,
  onChange,
}: {
  schedule: Slot[];
  subjectId: string | null;
  subjectName: string;
  value: DueValue;
  onChange: (v: DueValue) => void;
}) {
  const locale = getLocale();
  const today = todayISO();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = parseISO(value.date || today);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [picked, setPicked] = useState<string | null>(null);

  const headers = useMemo(() => weekdayHeaders(locale), [locale]);
  const grid = useMemo(() => monthGrid(view.year, view.month), [view]);

  const close = () => { setOpen(false); setPicked(null); };
  const commit = (date: string, period: number | null) => { onChange({ date, period }); close(); };

  const lessonsFor = (iso: string) => lessonsOn(schedule, subjectId, isoWeekday(iso));

  const pick = (iso: string) => {
    const lessons = lessonsFor(iso);
    if (!subjectId) return commit(iso, null);       // no subject → no lesson logic
    if (lessons.length === 1) return commit(iso, lessons[0].period);
    setPicked((p) => (p === iso ? null : iso));     // 0 lessons, or a choice to make
  };

  const shiftMonth = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const pickedLessons = picked ? lessonsFor(picked) : [];
  const upcoming = subjectId ? nextLessonDate(schedule, subjectId, today) : null;

  const triggerLabel = value.date
    ? `${formatFullDate(value.date, locale)}${value.period != null ? ` · ${m.due_lesson_n({ n: String(value.period) })}` : ''}`
    : m.due_pick();

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setPicked(null); }}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm transition-colors hover:bg-surface2"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate capitalize text-ink">{triggerLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      <Modal
        open={open}
        onClose={close}
        title={m.due_pick()}
        footer={<Button variant="secondary" className="w-full sm:w-auto" onClick={close}>{m.due_close()}</Button>}
      >
        <div className="mx-auto w-full max-w-sm space-y-4">
          {/* quick shortcuts */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => pick(today)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface2">
              {m.due_today()}
            </button>
            <button onClick={() => pick(addDays(today, 1))} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface2">
              {m.due_tomorrow()}
            </button>
            {upcoming && upcoming !== today && upcoming !== addDays(today, 1) && (
              <button onClick={() => pick(upcoming)} className="rounded-full border border-primary/40 bg-primary-soft px-3 py-1.5 text-sm text-primary hover:brightness-[0.98]">
                {m.due_next_lesson()}
              </button>
            )}
          </div>

          {!subjectId && (
            <p className="rounded-xl bg-surface2 px-3 py-2 text-xs text-muted">{m.due_no_subject()}</p>
          )}

          {/* month header */}
          <div className="flex items-center justify-between">
            <button onClick={() => shiftMonth(-1)} className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-surface2" aria-label="previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize">{monthLabel(view.year, view.month, locale)}</span>
            <button onClick={() => shiftMonth(1)} className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-surface2" aria-label="next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted">
            {headers.map((h) => <span key={h}>{h}</span>)}
          </div>

          {/* day grid */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map((iso) => {
              const d = parseISO(iso);
              const inMonth = d.getMonth() === view.month;
              const lessons = lessonsFor(iso);
              const has = lessons.length > 0;
              const isSelected = iso === value.date;
              const isPicked = iso === picked;
              const isToday = iso === today;
              const past = iso < today;
              return (
                <button
                  key={iso}
                  onClick={() => pick(iso)}
                  className={cn(
                    'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors',
                    !inMonth && 'text-muted/35',
                    inMonth && !has && 'text-muted hover:bg-surface2',
                    inMonth && has && !isSelected && 'bg-primary-soft text-primary hover:brightness-[0.98]',
                    isSelected && 'bg-primary text-primary-ink',
                    isPicked && !isSelected && 'ring-2 ring-primary/50',
                    past && !isSelected && 'opacity-55',
                  )}
                >
                  {d.getDate()}
                  {has && (
                    <span className={cn(
                      'absolute bottom-1 flex items-center gap-0.5 text-[9px] font-bold leading-none',
                      isSelected ? 'text-primary-ink/90' : 'text-primary',
                    )}>
                      {lessons.length > 1 ? `${lessons.length}×` : '•'}
                    </span>
                  )}
                  {isToday && !isSelected && <span className="absolute inset-x-0 -bottom-0 mx-auto h-1 w-1 rounded-full bg-accent" />}
                </button>
              );
            })}
          </div>

          {/* legend */}
          {subjectId && (
            <p className="flex items-center justify-center gap-2 text-[11px] text-muted">
              <span className="h-2.5 w-2.5 rounded bg-primary-soft" /> {m.due_legend_lesson()}
              <span className="ml-2">2×</span> {m.due_legend_multi()}
            </p>
          )}

          {/* detail for the currently picked day */}
          {picked && (
            <div className="animate-rise rounded-xl border border-line bg-surface2 p-3">
              <p className="text-sm font-semibold capitalize">{formatFullDate(picked, locale)}</p>

              {pickedLessons.length > 1 ? (
                <>
                  <p className="mt-1 text-xs text-muted">{m.due_multi({ n: String(pickedLessons.length), subject: subjectName })}</p>
                  <div className="mt-2 grid gap-2">
                    {pickedLessons.map((l) => (
                      <button
                        key={l.period}
                        onClick={() => commit(picked, l.period)}
                        className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm hover:border-primary"
                      >
                        <span className="font-semibold">{m.due_lesson_n({ n: String(l.period) })}</span>
                        {formatLessonTime(l) && <span className="text-xs text-muted tnum">{formatLessonTime(l)}</span>}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1.5 flex items-start gap-2 text-sm text-amber-600">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {pickedLessons.length === 0 && isWeekend(picked)
                        ? m.due_weekend()
                        : m.due_no_lesson({ date: formatDayMonth(picked, locale), subject: subjectName || '—' })}
                    </span>
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setPicked(null)}>{m.common_cancel()}</Button>
                    <Button variant="primary" size="sm" onClick={() => commit(picked, null)}>{m.due_use_anyway()}</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
