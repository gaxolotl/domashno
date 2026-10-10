import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut, Plus, Ticket } from 'lucide-react';
import { Button, Card, Field, Input, Segmented, cn } from '../../components/ui';
import { LanguageControl, ThemeControl } from '../../components/Controls';
import { api } from '../../lib/api';
import { useMe } from '../../lib/hooks';
import { m } from '../../paraglide/messages';

export default function OnboardingPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const me = useMe();
  const [name, setName] = useState(me.data?.user?.name ?? '');
  const [tab, setTab] = useState<'create' | 'join'>(params.get('tab') === 'join' ? 'join' : 'create');
  const [className, setClassName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ensureName = async () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== me.data?.user?.name) await api.rename(trimmed);
  };

  const create = async () => {
    if (!className.trim()) return setError(m.common_required());
    setBusy(true);
    setError('');
    try {
      await ensureName();
      const { class: cls } = await api.createClass(className.trim());
      nav(`/class/${cls.id}/settings`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error());
      setBusy(false);
    }
  };

  const join = async () => {
    if (!code.trim()) return setError(m.common_required());
    setBusy(true);
    setError('');
    try {
      await ensureName();
      const { class: cls } = await api.joinClass(code.trim().toUpperCase());
      nav(`/class/${cls.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : m.common_error());
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
        <span className="font-display text-lg font-bold text-ink">Домашно</span>
        <div className="flex items-center gap-2">
          <LanguageControl />
          <ThemeControl />
          <Button variant="ghost" size="icon" title={m.nav_signout()} onClick={async () => { await api.logout(); location.assign('/'); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-16">
        <div className="animate-rise mt-6">
          <h1 className="text-3xl">{m.onb_title()}</h1>
          <p className="mt-2 text-muted">{m.onb_subtitle()}</p>
        </div>

        <Card className="animate-rise mt-6 p-5">
          <Field label={m.onb_step_name()}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={m.auth_name()} />
          </Field>

          <div className="mt-5">
            <Segmented
              value={tab}
              onChange={(v) => { setTab(v); setError(''); }}
              options={[
                { value: 'create', label: <span className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4" />{m.onb_create_tab()}</span> },
                { value: 'join', label: <span className="inline-flex items-center gap-1.5"><Ticket className="h-4 w-4" />{m.onb_join_tab()}</span> },
              ]}
            />
          </div>

          <div className="mt-4 space-y-4">
            {tab === 'create' ? (
              <>
                <Field label={m.onb_class_name()}>
                  <Input
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder={m.onb_class_name_ph()}
                    autoFocus
                  />
                </Field>
                <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={create}>
                  {m.onb_create_btn()}
                </Button>
              </>
            ) : (
              <>
                <Field label={m.onb_invite_code()}>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder={m.onb_invite_ph()}
                    className={cn('font-mono tracking-[0.25em] uppercase')}
                    maxLength={10}
                    autoFocus
                  />
                </Field>
                <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={join}>
                  {m.onb_join_btn()}
                </Button>
              </>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red">{error}</p>}
        </Card>
      </main>
    </div>
  );
}
