import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, EmptyState, HomeworkGridSkeleton, Segmented, Select } from '../../components/ui';
import { useClassCtx } from '../class/ClassShell';
import { HomeworkCard, DueChip } from '../homework/HomeworkCard';
import { HomeworkEditor } from '../homework/HomeworkEditor';
import { useConfig, useDeleteHomework, useHomework, useMe } from '../../lib/hooks';
import type { Homework } from '../../lib/api';
import { formatFullDate, todayISO } from '../../lib/dates';
import { getLocale } from '../../paraglide/runtime';
import { m } from '../../paraglide/messages';

type Scope = 'upcoming' | 'past' | 'all';

export default function HomeworkPage() {
  const { detail, classId, canPost } = useClassCtx();
  const me = useMe();
  const { data: config } = useConfig();
  const { data, isLoading } = useHomework(classId);
  const del = useDeleteHomework(classId);

  const [scope, setScope] = useState<Scope>('upcoming');
  const [subject, setSubject] = useState('');
  const [ed, setEd] = useState<{ open: boolean; editing?: Homework | null }>({ open: false });

  const today = todayISO();
  const list = useMemo(() => {
    let items = data?.homework ?? [];
    if (subject) items = items.filter((h) => h.subject?.id === subject);
    if (scope === 'upcoming') items = items.filter((h) => h.due_date >= today);
    if (scope === 'past') items = items.filter((h) => h.due_date < today).reverse();
    return items;
  }, [data, subject, scope, today]);

  const groups = useMemo(() => {
    const map = new Map<string, Homework[]>();
    for (const h of list) {
      if (!map.has(h.due_date)) map.set(h.due_date, []);
      map.get(h.due_date)!.push(h);
    }
    return [...map.entries()];
  }, [list]);

  const canEdit = (h: Homework) =>
    canPost(h.subject?.id ?? null) || Boolean(me.data?.user?.id && h.author?.id === me.data.user.id);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl">{m.hw_title()}</h1>
        <Button variant="primary" onClick={() => setEd({ open: true })}>
          <Plus className="h-4 w-4" />
          {m.hw_new()}
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'upcoming', label: m.hw_upcoming() },
            { value: 'past', label: m.hw_past() },
            { value: 'all', label: m.common_all() },
          ]}
        />
        <div className="min-w-44">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">{m.hw_filter_subject()}: {m.common_all().toLowerCase()}</option>
            {detail.subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <HomeworkGridSkeleton />
      ) : groups.length === 0 ? (
        <EmptyState
          title={m.hw_none()}
          hint={m.hw_none_hint()}
          action={<Button variant="primary" onClick={() => setEd({ open: true })}>{m.hw_new()}</Button>}
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([date, items], gi) => (
            <section key={date} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold capitalize text-ink">{formatFullDate(date, getLocale())}</h2>
                <DueChip due={date} />
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((h, i) => (
                  <HomeworkCard
                    key={h.id}
                    hw={h}
                    index={gi * 2 + i}
                    canEdit={canEdit(h)}
                    onEdit={() => setEd({ open: true, editing: h })}
                    onDelete={() => { if (confirm(m.hw_delete_confirm())) del.mutate(h.id); }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <HomeworkEditor
        open={ed.open}
        onClose={() => setEd({ open: false })}
        classId={classId}
        subjects={detail.subjects}
        schedule={detail.schedule}
        editing={ed.editing}
        canPost={canPost}
        maxMb={detail.class.features?.upload_mb ?? config?.maxUploadMb ?? 25}
      />
    </div>
  );
}
