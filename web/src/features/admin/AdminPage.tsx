import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Ban, Check, Fingerprint, LayoutList, ListChecks, RefreshCw, Search, ShieldCheck, Trash2, Users as UsersIcon,
} from 'lucide-react';
import {
  Avatar, Badge, Button, Card, Field, Input, Modal, PageLoader, PageSkeleton, Segmented, Select, cn, useToast,
} from '../../components/ui';
import { LanguageControl, ThemeControl } from '../../components/Controls';
import { api, type AdminClass, type ClassFeatures, type LoginEvent } from '../../lib/api';
import { useMe } from '../../lib/hooks';
import { humanSize } from '../../lib/dates';
import { getLocale } from '../../paraglide/runtime';
import { m } from '../../paraglide/messages';
import FilesTab from './FilesTab';

type Tab = 'stats' | 'users' | 'classes' | 'files' | 'logins';

const fmtDate = (iso?: string | null) => {
  if (!iso) return m.admin_never();
  const d = new Date(iso);
  return `${new Intl.DateTimeFormat(getLocale() === 'bg' ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'short', year: '2-digit' }).format(d)} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const shortUa = (ua?: string | null) => {
  if (!ua) return '—';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '?';
  return `${browser} · ${os}`;
};

export default function AdminPage() {
  const me = useMe();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('stats');

  if (me.isLoading) return <PageLoader />;
  if (!me.data?.user?.is_admin) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <ShieldCheck className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 text-muted">{m.admin_not_admin()}</p>
          <Button className="mt-4" onClick={() => nav('/')}>{m.common_back()}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
        <Button variant="ghost" size="icon" onClick={() => nav('/')} aria-label={m.common_back()} title={m.common_back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl sm:text-2xl">{m.admin_title()}</h1>
        <div className="ml-auto flex items-center gap-2">
          <ThemeControl />
          <LanguageControl />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 pb-16 sm:px-6">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'stats', label: m.admin_tab_stats() },
            { value: 'users', label: m.admin_tab_users() },
            { value: 'classes', label: m.admin_tab_classes() },
            { value: 'files', label: m.admin_tab_files() },
            { value: 'logins', label: m.admin_tab_logins() },
          ]}
        />
        {tab === 'stats' && <StatsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'classes' && <ClassesTab />}
        {tab === 'files' && <FilesTab />}
        {tab === 'logins' && <LoginsTab />}
      </main>
    </div>
  );
}

/* ---------------------------------- stats --------------------------------- */

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: React.ReactNode }) {
  return (
    <Card className="p-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink tnum">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  );
}

function StatsTab() {
  const { data } = useQuery({ queryKey: ['admin', 'stats'], queryFn: api.adminStats });
  if (!data) return <PageSkeleton />;
  const s = data.stats;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label={m.admin_tab_users()}
          value={s.users}
          hint={
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5"><Check className="h-3 w-3" />{s.verified}</span>
              <span className="inline-flex items-center gap-0.5"><Ban className="h-3 w-3" />{s.banned}</span>
            </span>
          }
        />
        <StatCard label={m.admin_tab_classes()} value={s.classes} hint={`${s.subjects} · ${s.slots}`} />
        <StatCard label={m.admin_homework()} value={s.homework} hint={`${s.attachments} ${m.admin_attachments().toLowerCase()}`} />
        <StatCard label={m.admin_storage()} value={humanSize(s.storageBytes)} />
        <StatCard label={m.admin_sessions()} value={s.activeSessions} />
        <StatCard label={m.admin_logins24()} value={s.logins24} />
        <StatCard label={m.admin_new7()} value={s.newUsers7} />
        <StatCard label={m.admin_new30()} value={s.newUsers30} />
      </div>

      {s.providers.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium text-muted">{m.admin_providers()}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {s.providers.map((p) => <Badge key={p.provider} className="bg-primary-soft text-primary">{p.provider} · {p.n}</Badge>)}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <p className="border-b border-line px-4 py-2.5 text-sm font-semibold">{m.admin_top_classes()}</p>
          <ul className="divide-y divide-line">
            {s.topClasses.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{c.name}</span>
                <span className="truncate text-xs text-muted">{c.owner}</span>
                <span className="shrink-0 text-xs text-muted tnum"><span className="inline-flex items-center gap-0.5"><UsersIcon className="h-3.5 w-3.5" />{c.members}</span>
                    <span className="inline-flex items-center gap-0.5"><ListChecks className="h-3.5 w-3.5" />{c.homework}</span></span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <p className="border-b border-line px-4 py-2.5 text-sm font-semibold">{m.admin_recent_users()}</p>
          <ul className="divide-y divide-line">
            {s.recentUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                <Avatar name={u.name} size={24} />
                <span className="min-w-0 flex-1 truncate text-ink">{u.name}</span>
                <span className="truncate text-xs text-muted">{u.email}</span>
                {u.banned_at ? <Badge className="bg-red/15 text-red">{m.admin_banned()}</Badge>
                  : u.email_verified ? null : <Badge>{m.admin_filter_unverified()}</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------- users --------------------------------- */

function UsersTab() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', q, filter],
    queryFn: () => api.adminUsers({ q, filter, limit: 100 }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.admin_search()} className="pl-9" />
        </div>
        <div className="w-44">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">{m.admin_filter_all()}</option>
            <option value="banned">{m.admin_filter_banned()}</option>
            <option value="verified">{m.admin_filter_verified()}</option>
            <option value="unverified">{m.admin_filter_unverified()}</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          <div className="flex items-center gap-3 bg-surface2 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted">
            <span className="flex-1">{m.admin_name()}</span>
            <span className="hidden w-24 sm:block">{m.admin_status()}</span>
            <span className="hidden w-28 text-right sm:block">{m.admin_last_seen()}</span>
          </div>
          {(data?.users ?? []).map((u) => (
            <button key={u.id} onClick={() => setOpenId(u.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface2">
              <Avatar name={u.name} src={u.avatar_url} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{u.name}</span>
                <span className="block truncate text-xs text-muted">{u.email ?? '—'} · {u.classes ?? 0} {m.admin_tab_classes().toLowerCase()}</span>
              </span>
              <span className="hidden w-24 sm:block">
                {u.banned ? <Badge className="bg-red/15 text-red">{m.admin_banned()}</Badge>
                  : u.email_verified ? <Badge className="bg-primary-soft text-primary">{m.admin_verified()}</Badge>
                    : <Badge>—</Badge>}
              </span>
              <span className="hidden w-28 text-right text-xs text-muted tnum sm:block">{fmtDate(u.last_seen_at)}</span>
            </button>
          ))}
          {data && data.users.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">{m.hw_none()}</p>}
        </Card>
      )}

      {openId && <UserModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function UserModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => api.adminUser(id) });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!data) return;
    setName(data.user.name);
    setEmail(data.user.email ?? '');
    setReason(data.user.ban_reason ?? '');
  }, [data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin'] });
  };

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.adminUpdateUser(id, body as never),
    onSuccess: () => { refresh(); toast.push(m.admin_saved(), 'success'); },
    onError: (e: Error) => toast.push(e.message, 'error'),
  });
  const revoke = useMutation({
    mutationFn: () => api.adminRevokeSessions(id),
    onSuccess: () => { refresh(); toast.push(m.admin_revoke_done(), 'success'); },
  });
  const remove = useMutation({
    mutationFn: () => api.adminDeleteUser(id),
    onSuccess: () => { refresh(); onClose(); },
    onError: async (e: Error) => {
      if (confirm(`${e.message}. ${m.admin_delete_user_confirm()}`)) {
        await api.adminDeleteUser(id, true);
        refresh();
        onClose();
      }
    },
  });

  const u = data?.user;

  return (
    <Modal
      open
      onClose={onClose}
      title={m.admin_edit_user()}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => confirm(m.admin_delete_user_confirm()) && remove.mutate()}>
            <Trash2 className="h-3.5 w-3.5" /> {m.admin_delete()}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>{m.common_close()}</Button>
            <Button
              variant="primary"
              loading={patch.isPending}
              onClick={() => patch.mutate({ name, email: email.trim() || null })}
            >
              {m.common_save()}
            </Button>
          </div>
        </div>
      }
    >
      {!u ? <PageSkeleton /> : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar name={u.name} src={u.avatar_url} size={44} />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{u.name}</p>
              <p className="truncate text-xs text-muted">{u.email ?? '—'} · {m.admin_created()} {fmtDate(u.created_at)}</p>
            </div>
            <div className="ml-auto flex flex-wrap justify-end gap-1.5">
              {u.banned ? <Badge className="bg-red/15 text-red">{m.admin_banned()}</Badge>
                : u.email_verified ? <Badge className="bg-primary-soft text-primary">{m.admin_verified()}</Badge>
                  : <Badge>{m.admin_filter_unverified()}</Badge>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={m.admin_name()}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={m.admin_email()}><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={u.email_verified ? 'secondary' : 'primary'}
              onClick={() => patch.mutate({ email_verified: !u.email_verified })}
            >
              <Check className="h-3.5 w-3.5" /> {u.email_verified ? m.admin_filter_unverified() : m.admin_verified()}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => revoke.mutate()} loading={revoke.isPending}>
              <RefreshCw className="h-3.5 w-3.5" /> {m.admin_revoke()}
            </Button>
            {u.banned ? (
              <Button size="sm" variant="primary" onClick={() => patch.mutate({ banned: false })}>
                <Check className="h-3.5 w-3.5" /> {m.admin_unban()}
              </Button>
            ) : (
              <Button size="sm" variant="danger" onClick={() => patch.mutate({ banned: true, ban_reason: reason })}>
                <Ban className="h-3.5 w-3.5" /> {m.admin_ban()}
              </Button>
            )}
          </div>
          <Field label={m.admin_ban_reason()}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={m.admin_ban_reason()} />
          </Field>

          {data.memberships.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-muted">{m.admin_member_of()}</p>
              <ul className="space-y-1">
                {data.memberships.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {c.role === 'owner' && <Badge className="bg-accent/25 text-accent-ink">{m.admin_owner()}</Badge>}
                    <span className="text-xs text-muted tnum"><span className="inline-flex items-center gap-0.5"><UsersIcon className="h-3.5 w-3.5" />{c.members}</span>
                    <span className="inline-flex items-center gap-0.5"><ListChecks className="h-3.5 w-3.5" />{c.homework}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted">
              <Fingerprint className="h-4 w-4" /> {m.admin_fingerprints()}
            </p>
            {data.logins.length === 0 ? (
              <p className="text-sm text-muted">{m.admin_no_logins()}</p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {data.logins.map((l: LoginEvent) => (
                  <li key={l.id} className="rounded-lg border border-line px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="tnum text-muted">{fmtDate(l.created_at)}</span>
                      <span className="font-medium text-ink tnum">{l.ip ?? '—'}</span>
                      <span className="text-muted">{shortUa(l.user_agent)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-muted">
                      {l.timezone && <span>{m.admin_timezone()}: {l.timezone}</span>}
                      {l.screen && <span>{m.admin_screen()}: {l.screen}</span>}
                      {l.locale && <span>{m.admin_language()}: {l.locale}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* --------------------------------- classes -------------------------------- */

function ClassesTab() {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'classes', q], queryFn: () => api.adminClasses(q) });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.admin_search()} className="pl-9" />
      </div>

      {isLoading ? <PageSkeleton /> : (
        <Card className="divide-y divide-line overflow-hidden">
          {(data?.classes ?? []).map((c) => (
            <button key={c.id} onClick={() => setOpenId(c.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-surface2">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                  {c.features.official && <Badge className="bg-primary-soft text-primary">{m.badge_official()}</Badge>}
                  {c.features.featured && <Badge className="bg-accent/25 text-accent-ink">{m.badge_featured()}</Badge>}
                  {c.features.read_only && <Badge className="bg-red/10 text-red">{m.admin_read_only()}</Badge>}
                </span>
                <span className="block truncate text-xs text-muted">
                  {c.school ? `${c.school.name} · ` : ''}{c.owner_name} · {c.owner_email}
                </span>
              </span>
              <span className="text-xs text-muted tnum"><span className="inline-flex items-center gap-0.5"><UsersIcon className="h-3.5 w-3.5" />{c.members}</span>
                    <span className="inline-flex items-center gap-0.5"><ListChecks className="h-3.5 w-3.5" />{c.homework}</span>                    <span className="inline-flex items-center gap-0.5"><LayoutList className="h-3.5 w-3.5" />{c.subjects}</span></span>
            </button>
          ))}
          {data && data.classes.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">{m.hw_none()}</p>}
        </Card>
      )}

      {openId && <ClassModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ClassModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['admin', 'classes'], queryFn: () => api.adminClasses('') });
  const schoolsQ = useQuery({ queryKey: ['admin', 'schools'], queryFn: api.adminSchools });
  const cls: AdminClass | undefined = data?.classes.find((c) => c.id === id);

  const [name, setName] = useState('');
  const [policy, setPolicy] = useState<'everyone' | 'restricted'>('everyone');
  const [school, setSchool] = useState('');
  const [upload, setUpload] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [official, setOfficial] = useState(false);

  useEffect(() => {
    if (!cls) return;
    setName(cls.name);
    setPolicy(cls.post_policy);
    setSchool(cls.school?.name ?? '');
    setUpload(cls.features.upload_mb == null ? '' : String(cls.features.upload_mb));
    setReadOnly(cls.features.read_only);
    setFeatured(cls.features.featured);
    setOfficial(cls.features.official);
  }, [cls]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.adminUpdateClass(id, body as never),
    onSuccess: () => { refresh(); toast.push(m.admin_saved(), 'success'); },
    onError: (e: Error) => toast.push(e.message, 'error'),
  });
  const remove = useMutation({
    mutationFn: () => api.adminDeleteClass(id),
    onSuccess: () => { refresh(); onClose(); },
  });

  const features: Partial<ClassFeatures> = {
    upload_mb: upload.trim() === '' ? null : Number(upload),
    read_only: readOnly,
    featured,
    official,
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={m.admin_edit_class()}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => confirm(m.admin_delete_class_confirm()) && remove.mutate()}>
            <Trash2 className="h-3.5 w-3.5" /> {m.admin_delete()}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>{m.common_close()}</Button>
            <Button
              variant="primary"
              loading={patch.isPending}
              onClick={() => patch.mutate({ name, post_policy: policy, school: school.trim(), features })}
            >
              {m.common_save()}
            </Button>
          </div>
        </div>
      }
    >
      {!cls ? <PageSkeleton /> : (
        <div className="space-y-4">
          <Field label={m.set_class_name()}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>

          <Field label={m.admin_owner()}>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{cls.owner_name} · {cls.owner_email}</span>
            </div>
          </Field>

          <Field label={m.admin_policy()}>
            <Select value={policy} onChange={(e) => setPolicy(e.target.value as 'everyone' | 'restricted')}>
              <option value="everyone">{m.set_everyone()}</option>
              <option value="restricted">{m.set_restricted()}</option>
            </Select>
          </Field>

          <Field label={m.admin_school()} hint={m.admin_school_hint()}>
            <Input
              list="admin-schools"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="СУ „Иван Вазов“"
              className="font-normal"
            />
          </Field>
          <datalist id="admin-schools">
            {(schoolsQ.data?.schools ?? []).map((s) => <option key={s.id} value={s.name} />)}
          </datalist>

          <div className="space-y-3 rounded-xl border border-line p-3">
            <p className="text-sm font-medium text-muted">{m.admin_features()}</p>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              {m.admin_official()}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              {m.admin_featured()}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              {m.admin_read_only()}
            </label>

            <Field label={m.admin_upload_mb()} hint={m.admin_upload_hint()}>
              <Input type="number" min={1} max={500} value={upload} onChange={(e) => setUpload(e.target.value)} placeholder="25" />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => patch.mutate({ new_invite: true })}>
              <RefreshCw className="h-3.5 w-3.5" /> {m.admin_new_invite()}
            </Button>
            <span className="text-xs text-muted">{m.set_invite()}: <span className="font-mono tracking-widest">{cls.invite_code}</span></span>
          </div>

          <p className="flex flex-wrap gap-x-3 text-xs text-muted tnum">
            <span className="inline-flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" />{cls.members} {m.admin_members().toLowerCase()}</span>
            <span className="inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />{cls.homework} {m.admin_homework().toLowerCase()}</span>
            <span className="inline-flex items-center gap-1"><LayoutList className="h-3.5 w-3.5" />{cls.subjects} {m.set_subjects().toLowerCase()}</span>
          </p>
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------------- logins -------------------------------- */

function LoginsTab() {
  const { data } = useQuery({ queryKey: ['admin', 'logins'], queryFn: () => api.adminLogins(80) });
  if (!data) return <PageSkeleton />;
  return (
    <Card className="divide-y divide-line overflow-hidden">
      {data.logins.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs">
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{l.user_name} <span className="text-muted">{l.user_email}</span></span>
          <span className="tnum text-muted">{fmtDate(l.created_at)}</span>
          <span className="font-medium tnum text-ink">{l.ip ?? '—'}</span>
          <span className={cn('text-muted')}>{shortUa(l.user_agent)}</span>
          {l.timezone && <span className="text-muted">{l.timezone}</span>}
        </div>
      ))}
      {data.logins.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">{m.admin_no_logins()}</p>}
    </Card>
  );
}
