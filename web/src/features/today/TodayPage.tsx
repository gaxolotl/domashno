import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Plus, User } from 'lucide-react';
import { Button, Card, EmptyState, HomeworkGridSkeleton, cn, revealDelay } from '../../components/ui';
import { useClassCtx } from '../class/ClassShell';
import { HomeworkEditor } from '../homework/HomeworkEditor';
import { HomeworkCard } from '../homework/HomeworkCard';
import { useConfig, useDeleteHomework, useHomework, useMe } from '../../lib/hooks';
import { formatFullDate, isoWeekday, todayISO } from '../../lib/dates';
import type { Homework, Slot } from '../../lib/api';
import { getLocale } from '../../paraglide/runtime';
import { m } from '../../paraglide/messages';

const toMin = (t: string): number | null => {
  const mm = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  return mm ? Number(mm[1]) * 60 + Number(mm[2]) : null;
};

function useNow(intervalMs = 20_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function MiniLesson({
  label,
  lesson,
  time,
  onAdd,
  active,
}: {
  label: string;
  lesson: Slot | null;
  time: string;
  onAdd: (lesson: Slot) => void;
  active?: boolean;
}) {
  return (
    <div className={cn('rounded-xl border p-2.5', active ? 'border-primary bg-primary-soft/50' : 'border-line bg-surface')}>
      <p className={cn('text-[11px] font-semibold uppercase tracking-wide', active ? 'text-primary' : 'text-muted')}>{label}</p>
      {lesson ? (
        <>
          <p className="mt-1 truncate text-sm font-semibold text-ink" title={lesson.subject}>{lesson.subject}</p>
          <div className="mt-1 flex items-center justify-between gap-1">
            <span className="text-xs text-muted tnum">{time || '—'}</span>
            <button
              onClick={() => onAdd(lesson)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface2 text-ink transition-colors hover:bg-primary hover:text-primary-ink"
              aria-label={m.today_add_homework()}
              title={m.today_add_homework()}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <p className="mt-2 py-3 text-center text-xs text-muted">—</p>
      )}
    </div>
  );
}

export default function TodayPage() {
  const { detail, classId, canPost, subjectColor } = useClassCtx();
  const me = useMe();
  const today = todayISO();
  const day = isoWeekday(today);
  const { data, isLoading: hwLoading } = useHomework(classId, { from: today, to: today });
  const { data: config } = useConfig();
  const del = useDeleteHomework(classId);
  const now = useNow();

  const [ed, setEd] = useState<{ open: boolean; subjectId?: string | null; date?: string; editing?: Homework | null }>({ open: false });

  const lessons = useMemo(
    () => detail.schedule.filter((s) => s.day === day).sort((a, b) => a.period - b.period),
    [detail.schedule, day],
  );

  const timed = lessons.filter((l) => toMin(l.start) != null && toMin(l.end) != null);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const current = timed.find((l) => toMin(l.start)! <= nowMin && nowMin < toMin(l.end)!) ?? null;
  const previous = [...timed].reverse().find((l) => toMin(l.end)! <= nowMin) ?? null;
  const next = timed.find((l) => toMin(l.start)! > nowMin) ?? null;

  const dueToday = data?.homework ?? [];
  const bySubject = useMemo(() => {
    const map = new Map<string, Homework[]>();
    for (const h of dueToday) {
      const key = h.subject?.id ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    }
    return map;
  }, [dueToday]);

  const canEdit = (h: Homework) =>
    canPost(h.subject?.id ?? null) || Boolean(me.data?.user?.id && h.author?.id === me.data.user.id);

  const openAdd = (lesson: Slot) => setEd({ open: true, date: today, subjectId: lesson.subject_id ?? null });
  const colorOf = (l: Slot) => l.color || subjectColor(l.subject_id ?? null);

  // The lesson the user most likely wants to add homework for right now.
  const focus = current ?? previous ?? next ?? lessons[lessons.length - 1] ?? null;
  const focusLabel = current ? m.today_now() : previous ? m.today_just_now() : next ? m.today_next() : '';
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">{m.nav_today()} · {clock}</p>
          <h1 className="mt-1 text-2xl capitalize sm:text-3xl">{formatFullDate(today, getLocale())}</h1>
          <p className="mt-1 text-sm text-muted">{lessons.length} {m.today_lessons()}</p>
        </div>
        <Button variant="primary" onClick={() => setEd({ open: true, date: today, subjectId: focus?.subject_id ?? null })}>
          <Plus className="h-4 w-4" />
          {m.today_add_homework()}
        </Button>
      </header>

      {detail.schedule.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-7 w-7" />}
          title={m.today_no_schedule()}
          action={<Link to={`/class/${classId}/schedule`}><Button variant="primary">{m.today_setup()}</Button></Link>}
        />
      ) : (
        <>
          {/* Now / previous / next */}
          {focus ? (
            <Card className="overflow-hidden">
              <div className="flex items-stretch">
                <span className="w-1.5 shrink-0" style={{ backgroundColor: colorOf(focus) }} />
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">{focusLabel}</span>
                    <span className="text-xs text-muted tnum">{focus.start}–{focus.end}</span>
                  </div>
                  <p className="mt-1 truncate text-xl font-bold text-ink">{focus.subject}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                    {focus.teacher && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{focus.teacher}</span>}
                    {focus.room && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{focus.room}</span>}
                  </div>
                  <Button variant="primary" className="mt-3" onClick={() => openAdd(focus)}>
                    <Plus className="h-4 w-4" />
                    {m.today_add_homework()}
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <EmptyState icon={<Clock className="h-7 w-7" />} title={lessons.length ? m.today_no_school() : m.today_no_school()} />
          )}

          {timed.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <MiniLesson label={m.today_prev()} lesson={previous} time={previous ? `${previous.start}–${previous.end}` : ''} onAdd={openAdd} />
              <MiniLesson label={m.today_now()} lesson={current} time={current ? `${current.start}–${current.end}` : ''} onAdd={openAdd} active />
              <MiniLesson label={m.today_next()} lesson={next} time={next ? `${next.start}–${next.end}` : ''} onAdd={openAdd} />
            </div>
          )}

          {/* Full day */}
          {lessons.length === 0 ? (
            <EmptyState icon={<Clock className="h-7 w-7" />} title={m.today_no_school()} />
          ) : (
            <section className="space-y-2">
              {lessons.map((lesson, li) => {
                const hw = lesson.subject_id ? bySubject.get(lesson.subject_id) ?? [] : [];
                const color = colorOf(lesson);
                const isNow = current?.id === lesson.id || (current && current.period === lesson.period && current.day === lesson.day);
                return (
                  <Card key={lesson.id ?? `${lesson.day}-${lesson.period}`} className={cn('animate-rise overflow-hidden', isNow && 'ring-2 ring-primary/40')} style={revealDelay(li)}>
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted tnum">{lesson.period}</span>
                      <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{lesson.subject}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                          {lesson.teacher && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{lesson.teacher}</span>}
                          {lesson.room && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{lesson.room}</span>}
                          {lesson.start && <span className="tnum">{lesson.start}–{lesson.end}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => openAdd(lesson)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface2 hover:text-primary"
                        title={m.today_add_homework()}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {hw.length > 0 && (
                      <ul className="space-y-1 border-t border-line bg-surface2/60 px-4 py-2.5">
                        {hw.map((h) => (
                          <li key={h.id} className="flex items-center gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate text-ink">{h.title}</span>
                            {h.attachments.length > 0 && <span className="text-xs text-muted">{h.attachments.length}📎</span>}
                            <button onClick={() => setEd({ open: true, editing: h })} className="text-xs font-medium text-primary hover:underline">{m.common_edit()}</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                );
              })}
            </section>
          )}
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-lg">{m.today_homework()}</h2>
        {hwLoading ? (
          <HomeworkGridSkeleton count={2} />
        ) : dueToday.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{m.today_none_homework()}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dueToday.map((h, i) => (
              <HomeworkCard
                key={h.id}
                hw={h}
                index={i}
                canEdit={Boolean(canEdit(h))}
                onEdit={() => setEd({ open: true, editing: h })}
                onDelete={() => { if (confirm(m.hw_delete_confirm())) del.mutate(h.id); }}
              />
            ))}
          </div>
        )}
      </section>

      <HomeworkEditor
        open={ed.open}
        onClose={() => setEd({ open: false })}
        classId={classId}
        subjects={detail.subjects}
        editing={ed.editing}
        defaultDate={ed.date}
        defaultSubjectId={ed.subjectId}
        canPost={canPost}
        maxMb={config?.maxUploadMb ?? 25}
      />
    </div>
  );
}
