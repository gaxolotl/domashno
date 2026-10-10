import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Crown, KeyRound, LogOut, Plus, ShieldCheck, ShieldOff, Trash2, UserMinus } from 'lucide-react';
import { Avatar, Badge, Button, Card, Field, Input, Modal, Segmented, cn, useToast } from '../../components/ui';
import { useClassCtx } from '../class/ClassShell';
import { TimetableSection } from '../schedule/TimetableSection';
import { api, type Member, type Subject } from '../../lib/api';
import { useMe } from '../../lib/hooks';
import { m } from '../../paraglide/messages';

const COLORS = ['#1E7A4C', '#2F6FB0', '#B1539A', '#C2703A', '#8A6D1F', '#4C6B8A', '#A63D57', '#3F8F8A', '#7A5AA8', '#6A8E3A'];

export default function SettingsPage() {
  const { detail, classId, canManage } = useClassCtx();
  const me = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();

  const [name, setName] = useState(detail.class.name);
  const [savingName, setSavingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [permSubject, setPermSubject] = useState<Subject | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTeacher, setNewTeacher] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['class', classId] });
    qc.invalidateQueries({ queryKey: ['classes'] });
  };
  const fail = (e: unknown) => toast.push(e instanceof Error ? e.message : m.common_error(), 'error');

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(detail.class.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const saveName = async () => {
    setSavingName(true);
    try {
      await api.updateClass(classId, { name: name.trim() });
      refresh();
      toast.push(m.set_saved(), 'success');
    } catch (e) { fail(e); } finally { setSavingName(false); }
  };

  const setPolicy = async (policy: 'everyone' | 'restricted') => {
    try {
      await api.updateClass(classId, { post_policy: policy });
      refresh();
    } catch (e) { fail(e); }
  };

  const regenerate = async () => {
    try {
      await api.newInvite(classId);
      refresh();
      toast.push(m.set_saved(), 'success');
    } catch (e) { fail(e); }
  };

  const promote = async (member: Member) => {
    try { await api.setMemberRole(classId, member.id, 'owner'); refresh(); } catch (e) { fail(e); }
  };
  const demote = async (member: Member) => {
    try { await api.setMemberRole(classId, member.id, 'member'); refresh(); } catch (e) { fail(e); }
  };
  const removeMember = async (member: Member) => {
    if (!confirm(m.set_remove_member_confirm())) return;
    try { await api.removeMember(classId, member.id); refresh(); } catch (e) { fail(e); }
  };

  const addSubject = async () => {
    if (!newName.trim()) return;
    try {
      await api.createSubject(classId, { name: newName.trim(), teacher: newTeacher.trim(), color: newColor });
      setNewName(''); setNewTeacher(''); setNewColor(COLORS[(detail.subjects.length + 1) % COLORS.length]);
      setAdding(false);
      refresh();
    } catch (e) { fail(e); }
  };

  const deleteSubject = async (s: Subject) => {
    if (!confirm(m.set_delete_subject_confirm())) return;
    try { await api.deleteSubject(s.id); refresh(); } catch (e) { fail(e); }
  };

  const leave = async () => {
    if (!confirm(m.set_leave_confirm())) return;
    try {
      await api.removeMember(classId, me.data!.user!.id);
      qc.invalidateQueries({ queryKey: ['classes'] });
      nav('/');
    } catch (e) { fail(e); }
  };

  const deleteClass = async () => {
    if (!confirm(m.set_delete_class_confirm())) return;
    try {
      await api.deleteClass(classId);
      qc.invalidateQueries({ queryKey: ['classes'] });
      nav('/');
    } catch (e) { fail(e); }
  };

  const signOut = async () => {
    try {
      await api.logout();
    } finally {
      location.assign('/');
    }
  };

  const restricted = detail.class.post_policy === 'restricted';

  return (
    <div className="stagger space-y-6">
      <h1 className="text-2xl">{m.set_title()}</h1>

      {/* Account */}
      <Card className="flex items-center gap-3 p-4">
        <Avatar name={me.data?.user?.name ?? ''} src={me.data?.user?.avatar_url} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{me.data?.user?.name}</p>
          {me.data?.user?.email && <p className="truncate text-xs text-muted">{me.data.user.email}</p>}
        </div>
        <Button variant="secondary" size="sm" className="shrink-0" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          {m.nav_signout()}
        </Button>
      </Card>

      {/* Class name */}
      <Card className="space-y-3 p-5">
        <Field label={m.set_class_name()}>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
            {canManage && name.trim() !== detail.class.name && (
              <Button variant="primary" loading={savingName} onClick={saveName}>{m.common_save()}</Button>
            )}
          </div>
        </Field>
      </Card>

      {/* Invite */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="text-lg">{m.set_invite()}</h2>
        </div>
        <p className="text-sm text-muted">{m.set_invite_hint()}</p>
        <div className="space-y-2">
          <div className="rounded-xl border border-line bg-surface2 px-4 py-3 text-center font-mono text-2xl font-semibold tracking-[0.28em] text-ink">
            {detail.class.invite_code}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={copyCode}>
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              {copied ? m.common_copied() : m.common_copy()}
            </Button>
            {canManage && (
              <Button variant="ghost" className="flex-1" onClick={regenerate}>{m.set_new_code()}</Button>
            )}
          </div>
        </div>
      </Card>

      {/* Post policy */}
      <Card className="space-y-3 p-5">
        <h2 className="text-lg">{m.set_who_can_post()}</h2>
        <Segmented
          value={detail.class.post_policy}
          onChange={(v) => canManage && setPolicy(v)}
          className={cn(!canManage && 'pointer-events-none opacity-70')}
          options={[
            { value: 'everyone', label: <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />{m.set_everyone()}</span> },
            { value: 'restricted', label: <span className="inline-flex items-center gap-1.5"><ShieldOff className="h-4 w-4" />{m.set_restricted()}</span> },
          ]}
        />
        <p className="text-sm text-muted">{m.set_post_policy_hint()}</p>
      </Card>

      {/* Members */}
      <Card className="p-5">
        <h2 className="text-lg">{m.set_members()}</h2>
        <ul className="mt-3 divide-y divide-line">
          {detail.members.map((mem) => (
            <li key={mem.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <Avatar name={mem.name} src={mem.avatar_url} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{mem.name}{mem.id === me.data?.user?.id && <span className="text-muted"> · {m.auth_signed_in_as().toLowerCase()}</span>}</p>
                {mem.email && <p className="truncate text-xs text-muted">{mem.email}</p>}
              </div>
              <div className="ml-auto flex items-center gap-1">
                {mem.role === 'owner' ? (
                  <Badge className="bg-accent/25 text-accent-ink"><Crown className="h-3 w-3" />{m.set_owner()}</Badge>
                ) : (
                  <Badge>{m.set_member()}</Badge>
                )}
                {canManage && mem.id !== me.data?.user?.id && (
                  <>
                    {mem.role === 'member' ? (
                      <Button size="sm" variant="ghost" onClick={() => promote(mem)} title={m.set_make_owner()}>
                        <Crown className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => demote(mem)}>{m.set_member()}</Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red" onClick={() => removeMember(mem)} title={m.set_remove_member()}>
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Subjects */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg">{m.set_subjects()}</h2>
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> {m.set_add_subject()}
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {detail.subjects.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface2/60 px-3 py-2">
              <span className="h-6 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="font-medium">{s.name}</span>
              {s.teacher && <span className="text-sm text-muted">· {s.teacher}</span>}
              <span className="flex-1" />
              {restricted && canManage && (
                <Button size="sm" variant="ghost" onClick={() => setPermSubject(s)}>
                  {s.permitted_user_ids.length > 0 ? m.set_can_post() + ` (${s.permitted_user_ids.length})` : m.set_subject_permissions()}
                </Button>
              )}
              {canManage && (
                <button onClick={() => deleteSubject(s)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red/10 hover:text-red" aria-label={m.common_delete()}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
          {detail.subjects.length === 0 && <p className="py-3 text-center text-sm text-muted">{m.sch_manual()}</p>}
        </ul>
      </Card>

      {/* Timetable (import from Shkolo + editor) */}
      <section className="panel p-5">
        <TimetableSection />
      </section>

      {/* Danger zone */}
      <Card className="space-y-3 border-red/30 p-5">
        <h2 className="text-lg text-red">{m.set_danger_zone()}</h2>
        <div className="flex flex-wrap gap-2">
          {!canManage && <Button variant="danger" onClick={leave}>{m.set_leave()}</Button>}
          {canManage && <Button variant="danger" onClick={deleteClass}>{m.set_delete_class()}</Button>}
        </div>
      </Card>

      {/* Add subject modal */}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={m.set_add_subject()}
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setAdding(false)}>{m.common_cancel()}</Button><Button variant="primary" onClick={addSubject}>{m.common_add()}</Button></div>}
      >
        <div className="space-y-4">
          <Field label={m.set_subject_name()}>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </Field>
          <Field label={m.set_teacher_ph()}>
            <Input value={newTeacher} onChange={(e) => setNewTeacher(e.target.value)} />
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">{m.set_subject_color()}</span>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={cn('h-8 w-8 rounded-full border-2 transition-transform', newColor === c ? 'scale-110 border-ink' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Permissions modal */}
      <Modal open={Boolean(permSubject)} onClose={() => setPermSubject(null)} title={permSubject ? `${m.set_subject_permissions()}: ${permSubject.name}` : ''}>
        {permSubject && (
          <div className="space-y-2">
            {detail.members.map((mem) => {
              const checked = permSubject.permitted_user_ids.includes(mem.id);
              return (
                <label key={mem.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 hover:bg-surface2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={async () => {
                      const next = checked
                        ? permSubject.permitted_user_ids.filter((id) => id !== mem.id)
                        : [...permSubject.permitted_user_ids, mem.id];
                      setPermSubject({ ...permSubject, permitted_user_ids: next });
                      try { await api.setSubjectPermissions(permSubject.id, next); refresh(); } catch (e) { fail(e); }
                    }}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  <Avatar name={mem.name} src={mem.avatar_url} size={28} />
                  <span className="text-sm">{mem.name}</span>
                  {mem.role === 'owner' && <Badge className="ml-auto bg-accent/25 text-accent-ink">{m.set_owner()}</Badge>}
                </label>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
