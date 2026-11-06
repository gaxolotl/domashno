import { Check, Circle, Loader2 } from 'lucide-react';
import { cn, useToast } from '../../components/ui';
import type { LessonLog, Slot } from '../../lib/api';
import { todayISO } from '../../lib/dates';
import { useLogLesson, useMe, useUnlogLesson } from '../../lib/hooks';
import { m } from '../../paraglide/messages';
import { useClassCtx } from '../class/ClassShell';

/** One shared checkmark per date/period. Only the logger or owner can undo it. */
export function LessonLogButton({ date, lesson, log, compact = false, loading = false }: {
  date: string;
  lesson: Slot;
  log?: LessonLog;
  compact?: boolean;
  loading?: boolean;
}) {
  const { classId, canManage, detail } = useClassCtx();
  const me = useMe();
  const toast = useToast();
  const add = useLogLesson(classId);
  const remove = useUnlogLesson(classId);
  const readOnly = detail.class.features?.read_only && !me.data?.user?.is_admin;
  const canUndo = canManage || me.data?.user?.is_admin || log?.logger?.id === me.data?.user?.id;
  const today = todayISO();
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const future = date > today || (date === today && Boolean(lesson.start && lesson.start > time));
  const pending = add.isPending || remove.isPending;
  const title = log
    ? `${m.lesson_logged()}${log.logger ? ` · ${m.lesson_logged_by({ name: log.logger.name })}` : ''}${canUndo ? ` · ${m.lesson_unlog()}` : ''}`
    : future ? m.lesson_future() : m.lesson_log();
  const onError = (e: Error) => toast.push(e.message, 'error');

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={Boolean(log)}
      disabled={loading || pending || Boolean(readOnly) || future || Boolean(log && !canUndo)}
      onClick={() => {
        if (log) remove.mutate({ date, period: lesson.period }, { onError });
        else add.mutate({ date, period: lesson.period, subject_id: lesson.subject_id ?? null }, { onError });
      }}
      className={cn(
        'grid shrink-0 place-items-center rounded-lg border disabled:cursor-default',
        compact ? 'h-7 w-7' : 'h-9 w-9',
        log ? 'border-primary/40 bg-primary-soft text-primary' : 'border-line text-muted enabled:hover:bg-primary-soft enabled:hover:text-primary',
      )}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : log ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
    </button>
  );
}

export function LessonLogStatus({ log, compact = false }: { log?: LessonLog; compact?: boolean }) {
  if (!log) return null;
  return (
    <p className="mt-1 flex min-w-0 items-start gap-1 text-xs text-primary">
      {!compact && <Check className="mt-0.5 h-3 w-3 shrink-0" />}
      <span className="break-words" title={log.logger?.name}>
        {log.logger ? compact ? log.logger.name : m.lesson_logged_by({ name: log.logger.name }) : m.lesson_logged()}
      </span>
    </p>
  );
}
