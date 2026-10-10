import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button, Card, EmptyState, cn, revealDelay } from '../../components/ui';
import { useClassCtx } from '../class/ClassShell';
import { HomeworkEditor } from '../homework/HomeworkEditor';
import { useConfig, useHomework } from '../../lib/hooks';
import type { Homework } from '../../lib/api';
import { addDays, formatDayMonth, startOfWeek, todayISO } from '../../lib/dates';
import { getLocale } from '../../paraglide/runtime';
import { m } from '../../paraglide/messages';

const dayName = (d: number) => (m as unknown as Record<string, () => string>)[`day_short_${d}`]();

export default function WeekPage() {
  const { detail, classId, canPost, subjectColor } = useClassCtx();
  const { data: config } = useConfig();
  const [offset, setOffset] = useState(0);
  const today = todayISO();

  const monday = addDays(startOfWeek(today), offset * 7);
  const sunday = addDays(monday, 6);
  const { data } = useHomework(classId, { from: monday, to: sunday });
  const homework = data?.homework ?? [];

  const [ed, setEd] = useState<{ open: boolean; subjectId?: string | null; date?: string; editing?: Homework | null }>({ open: false });

  // Which weekday columns to show: Monâ€“Fri, plus any used weekend days.
  const usedDays = useMemo(() => {
    const set = new Set(detail.schedule.map((s) => s.day));
    const max = Math.max(5, ...set);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [detail.schedule]);

  if (detail.schedule.length === 0) {
    return (
      <EmptyState
        title={m.timetable_empty()}
        hint={m.sch_subtitle()}
        action={<Button variant="primary" onClick={() => location.assign(`/class/${classId}/settings`)}>{m.today_setup()}</Button>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{m.week_title()}</h1>
          <p className="mt-1 text-sm text-muted tnum">
            {formatDayMonth(monday, getLocale())} â€” {formatDayMonth(sunday, getLocale())}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {offset !== 0 && <Button size="sm" variant="ghost" onClick={() => setOffset(0)}>{m.week_today()}</Button>}
          <div className="flex rounded-xl border border-line bg-surface">
            <Button size="icon" variant="ghost" className="rounded-r-none" onClick={() => setOffset((o) => o - 1)} aria-label="previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="rounded-l-none" onClick={() => setOffset((o) => o + 1)} aria-label="next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className={cn('grid gap-3', usedDays.length >= 5 ? 'sm:grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-3')}>
        {usedDays.map((d, di) => {
          const date = addDays(monday, d - 1);
          const isToday = date === today;
          const lessons = detail.schedule.filter((s) => s.day === d).sort((a, b) => a.period - b.period);
          const dayHw = homework.filter((h) => h.due_date === date);
          return (
            <Card key={d} className={cn('animate-rise flex flex-col overflow-hidden', isToday && 'ring-2 ring-primary/40')} style={revealDelay(di)}>
              <div className={cn('flex items-center justify-between px-3 py-2.5', isToday ? 'bg-primary text-primary-ink' : 'bg-surface2')}>
                <span className="font-display text-sm font-bold">{dayName(d)}</span>
                <span className={cn('text-xs tnum', isToday ? 'text-primary-ink/80' : 'text-muted')}>{formatDayMonth(date, getLocale())}</span>
              </div>
              <div className="flex-1 space-y-1 p-2">
                {lessons.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted">{m.week_empty()}</p>}
                {lessons.map((lesson) => {
                  const color = lesson.color || subjectColor(lesson.subject_id ?? null);
                  const count = lesson.subject_id ? dayHw.filter((h) => h.subject?.id === lesson.subject_id).length : 0;
                  return (
                    <button
                      key={lesson.id ?? `${d}-${lesson.period}`}
                      onClick={() => setEd({ open: true, date, subjectId: lesson.subject_id ?? null })}
                      className="group flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-line hover:bg-surface2"
                    >
                      <span className="w-4 shrink-0 text-center font-mono text-[11px] text-muted tnum">{lesson.period}</span>
                      <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium leading-tight text-ink">{lesson.subject}</span>
                        <span className="block font-mono text-[10px] text-muted">{lesson.start}â€“{lesson.end}</span>
                      </span>
                      {count > 0 && (
                        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">{count}</span>
                      )}
                      <Plus className="h-3.5 w-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <HomeworkEditor
        open={ed.open}
        onClose={() => setEd({ open: false })}
        classId={classId}
        subjects={detail.subjects}
        schedule={detail.schedule}
        editing={ed.editing}
        defaultDate={ed.date}
        defaultSubjectId={ed.subjectId}
        canPost={canPost}
        maxMb={detail.class.features?.upload_mb ?? config?.maxUploadMb ?? 25}
      />
    </div>
  );
}
