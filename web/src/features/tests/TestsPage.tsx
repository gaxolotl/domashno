import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ClipboardCheck, Pencil, Plus, Trash2, User } from 'lucide-react';
import { Avatar, Badge, Button, Card, EmptyState, Field, HomeworkGridSkeleton, Input, Modal, Segmented, Select, Textarea, revealDelay, useToast } from '../../components/ui';
import { api, ApiError, type ClassTest, type TestKind } from '../../lib/api';
import { useMe, useTests } from '../../lib/hooks';
import { formatFullDate, todayISO } from '../../lib/dates';
import { getLocale } from '../../paraglide/runtime';
import { m } from '../../paraglide/messages';
import { useClassCtx } from '../class/ClassShell';

type Scope = 'upcoming' | 'past';

const kindLabel = (kind: TestKind) => ({
  test: m.tests_kind_test(),
  exam: m.tests_kind_exam(),
  quiz: m.tests_kind_quiz(),
  oral: m.tests_kind_oral(),
  other: m.tests_kind_other(),
})[kind];

export default function TestsPage() {
  const { classId, detail, canManage } = useClassCtx();
  const me = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useTests(classId);
  const [scope, setScope] = useState<Scope>('upcoming');
  const [subject, setSubject] = useState('');
  const [editing, setEditing] = useState<ClassTest | null | undefined>(undefined);
  const today = todayISO();
  const readOnly = detail.class.features?.read_only && !me.data?.user?.is_admin;

  const list = useMemo(() => {
    const items = (data?.tests ?? []).filter((t) => !subject || t.subject?.id === subject);
    if (scope === 'upcoming') return items.filter((t) => !t.test_date || t.test_date >= today);
    return items.filter((t) => t.test_date && t.test_date < today).reverse();
  }, [data, scope, subject, today]);

  const remove = useMutation({
    mutationFn: api.deleteTest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tests', classId] }),
    onError: (e: Error) => toast.push(e.message, 'error'),
  });

  const canEdit = (t: ClassTest) => !readOnly && (canManage || me.data?.user?.is_admin || Boolean(me.data?.user?.id && t.author?.id === me.data.user.id));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">{m.tests_title()}</h1>
        </div>
        <Button variant="primary" onClick={() => setEditing(null)} disabled={Boolean(readOnly)}>
          <Plus className="h-4 w-4" />
          {m.tests_new()}
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'upcoming', label: m.tests_upcoming() },
            { value: 'past', label: m.tests_past() },
          ]}
        />
        <div className="min-w-44">
          <Select aria-label={m.tests_subject()} value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">{m.common_all()}</option>
            {detail.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      </div>

      {isError ? (
        <EmptyState title={m.common_error()} action={<Button onClick={() => refetch()}>{m.common_retry()}</Button>} />
      ) : isLoading ? <HomeworkGridSkeleton count={2} /> : list.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-7 w-7" />}
          title={m.tests_none()}
          hint={m.tests_none_hint()}
          action={!readOnly && <Button variant="primary" onClick={() => setEditing(null)}>{m.tests_new()}</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((t, i) => (
            <Card key={t.id} className="animate-rise overflow-hidden" style={revealDelay(i)}>
              <div className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge color={t.subject?.color}>{t.subject?.name ?? m.hw_subject_none()}</Badge>
                    <Badge>{kindLabel(t.kind)}</Badge>
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-ink">{t.title}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-sm font-medium text-primary">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span>{t.test_date ? formatFullDate(t.test_date, getLocale()) : m.tests_date_unknown()}</span>
                    {t.period != null && <span className="text-muted">· {m.due_lesson_n({ n: String(t.period) })}</span>}
                  </p>
                  {t.subject?.teacher && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <User className="h-3.5 w-3.5" />
                      {m.tests_teacher({ name: t.subject.teacher })}
                    </p>
                  )}
                  {t.details && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{t.details}</p>}
                  {t.author && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                      <Avatar name={t.author.name} src={t.author.avatar_url} size={20} />
                      {m.tests_announced_by({ name: t.author.name })}
                    </p>
                  )}
                </div>
                {canEdit(t) && (
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button onClick={() => setEditing(t)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label={m.common_edit()}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => confirm(m.tests_delete_confirm()) && remove.mutate(t.id)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red/10 hover:text-red"
                      aria-label={m.common_delete()}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <TestEditor
          classId={classId}
          subjects={detail.subjects}
          test={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}

function TestEditor({
  classId,
  subjects,
  test,
  onClose,
}: {
  classId: string;
  subjects: { id: string; name: string }[];
  test: ClassTest | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [subjectId, setSubjectId] = useState('');
  const [kind, setKind] = useState<TestKind>('test');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [date, setDate] = useState('');
  const [period, setPeriod] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setSubjectId(test?.subject?.id ?? '');
    setKind(test?.kind ?? 'test');
    setTitle(test?.title ?? '');
    setDetails(test?.details ?? '');
    setDate(test?.test_date ?? '');
    setPeriod(test?.period == null ? '' : String(test.period));
  }, [test]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        subject_id: subjectId || null,
        kind,
        title: title.trim(),
        details: details.trim(),
        test_date: date || null,
        period: period === '' ? null : Number(period),
      };
      return test ? api.updateTest(test.id, body) : api.createTest(classId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests', classId] });
      toast.push(test ? m.tests_saved() : m.tests_created(), 'success');
      onClose();
    },
    onError: (e: Error) => setError(e instanceof ApiError ? e.message : m.common_error()),
  });

  const submit = () => {
    if (!title.trim()) return setError(m.common_required());
    if (period !== '' && (!Number.isInteger(Number(period)) || Number(period) < 0 || Number(period) > 12)) return setError(m.common_required());
    setError('');
    save.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={test ? m.tests_edit() : m.tests_new()}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{m.common_cancel()}</Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>{m.common_save()}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={m.tests_subject()}>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">{m.hw_subject_none()}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label={m.tests_kind()}>
            <Select value={kind} onChange={(e) => setKind(e.target.value as TestKind)}>
              {(['test', 'exam', 'quiz', 'oral', 'other'] as TestKind[]).map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={m.tests_title_label()}>
          <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder={m.tests_title_ph()} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={m.tests_date()} hint={!date ? m.tests_date_unknown() : undefined}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={m.tests_period()}>
            <Input type="number" min={0} max={12} step={1} value={period} onChange={(e) => setPeriod(e.target.value)} />
          </Field>
        </div>
        <Field label={m.tests_details()}>
          <Textarea value={details} maxLength={20000} onChange={(e) => setDetails(e.target.value)} placeholder={m.tests_details_ph()} className="min-h-32" />
        </Field>
        {error && <p className="text-sm text-red">{error}</p>}
      </div>
    </Modal>
  );
}
