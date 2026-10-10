import { CalendarClock, Pencil, Trash2 } from 'lucide-react';
import { Avatar, Badge, cn, revealDelay } from '../../components/ui';
import type { Homework } from '../../lib/api';
import { daysBetween, formatFullDate, todayISO } from '../../lib/dates';
import { getLocale } from '../../paraglide/runtime';
import { m } from '../../paraglide/messages';
import { AttachmentGrid } from './HomeworkEditor';

export function DueChip({ due }: { due: string }) {
  const diff = daysBetween(todayISO(), due);
  const label = diff === 0 ? m.hw_due_today() : diff === 1 ? m.hw_due_tomorrow() : formatFullDate(due, getLocale());
  const tone = diff < 0 ? 'text-red' : diff === 0 ? 'text-primary' : 'text-muted';
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium tnum', tone)}>
      <CalendarClock className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function HomeworkCard({
  hw,
  onEdit,
  onDelete,
  canEdit,
  index = 0,
}: {
  hw: Homework;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit: boolean;
  index?: number;
}) {
  return (
    <article className="panel animate-rise overflow-hidden" style={revealDelay(index)}>
      <div className="flex items-start gap-3 px-4 pt-4">
        <span
          className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: hw.subject?.color || 'var(--muted)' }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {hw.subject ? (
              <Badge color={hw.subject.color}>{hw.subject.name}</Badge>
            ) : (
              <Badge>{m.hw_subject_none()}</Badge>
            )}
            <DueChip due={hw.due_date} />
          </div>
          <h3 className="mt-1.5 text-base font-semibold leading-snug text-ink">{hw.title}</h3>
          {hw.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{hw.body}</p>}
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-0.5">
            {onEdit && (
              <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label={m.common_edit()}>
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red/10 hover:text-red" aria-label={m.common_delete()}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {hw.attachments.length > 0 && (
        <div className="px-4 pb-1 pt-3">
          <AttachmentGrid items={hw.attachments} />
        </div>
      )}

      <div className="flex items-center gap-2 px-4 pb-3.5 pt-3 text-xs text-muted">
        {hw.author && (
          <>
            <Avatar name={hw.author.name} src={hw.author.avatar_url} size={20} />
            <span>{m.hw_by({ name: hw.author.name })}</span>
          </>
        )}
      </div>
    </article>
  );
}
