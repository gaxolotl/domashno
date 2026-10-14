import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Github, Mail, ShieldCheck } from 'lucide-react';
import { Button, Card, Field, Input } from '../../components/ui';
import { LanguageControl, ThemeControl } from '../../components/Controls';
import { Logo } from '../../components/Brand';
import { api, ApiError } from '../../lib/api';
import { useConfig } from '../../lib/hooks';
import { getLocale } from '../../paraglide/runtime';
import { m } from '../../paraglide/messages';
import Turnstile, { type TurnstileHandle } from './Turnstile';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.1-2 3.4-4.9 3.4-8.6Z" />
      <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 21.4 7.6 24 12 24Z" />
      <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3Z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.3 15.1 0 12 0 7.6 0 3.7 2.6 1.8 6.1l3.8 3C6.5 6.7 9 4.8 12 4.8Z" />
    </svg>
  );
}

function errorText(code: string): string {
  switch (code) {
    case 'invalid_email': return m.auth_email_invalid();
    case 'invalid_code': return m.auth_code_invalid();
    case 'code_expired': return m.auth_link_invalid();
    case 'too_many_requests':
    case 'too_many_attempts': return m.auth_too_many();
    case 'email_failed': return m.auth_email_failed();
    case 'terms_required': return m.auth_terms_required();
    case 'turnstile_failed': return m.auth_turnstile_failed();
    default: return m.common_error();
  }
}

export default function LoginPage() {
  const [params] = useSearchParams();
  const [providerInfo, setProviders] = useState<{ google: boolean; github: boolean; dev: boolean } | null>(null);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [showDev, setShowDev] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') === 'link' ? m.auth_link_invalid() : '');
  const codeRef = useRef<HTMLInputElement>(null);

  // Terms acceptance + bot check (Cloudflare Turnstile, when configured).
  const [accepted, setAccepted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const tsRef = useRef<TurnstileHandle>(null);
  const tsDevRef = useRef<TurnstileHandle>(null);
  const { data: config } = useConfig();
  const siteKey = config?.turnstileSiteKey ?? null;

  useEffect(() => {
    api.providers().then(setProviders).catch(() => setProviders({ google: false, github: false, dev: false }));
  }, []);

  const hasOAuth = Boolean(providerInfo && (providerInfo.google || providerInfo.github));

  /** Every sign-in path requires accepted terms and (when enabled) a fresh bot token. */
  const gate = () => {
    if (!accepted) {
      setError(m.auth_terms_required());
      return null;
    }
    if (siteKey && !token) {
      setError(m.auth_turnstile_required());
      return null;
    }
    setError('');
    return { terms: true as const, turnstile: token ?? undefined };
  };

  const useToken = () => {
    setToken(null);
    tsRef.current?.reset();
    tsDevRef.current?.reset();
  };

  // Turnstile load state: when the widget cannot load (blocked CDN, no
  // connection), show an explanatory box with a retry instead of nothing.
  const [tsFailed, setTsFailed] = useState(false);
  const [tsAttempt, setTsAttempt] = useState(0);
  const renderTs = (ref: RefObject<TurnstileHandle>) => {
    if (!siteKey) return null;
    if (tsFailed) {
      return (
        <div className="rounded-xl border border-line bg-surface2 px-4 py-3 text-center">
          <p className="text-sm text-muted">{m.auth_turnstile_unavailable()}</p>
          <button
            type="button"
            onClick={() => {
              setTsFailed(false);
              setTsAttempt((a) => a + 1);
            }}
            className="mt-1.5 text-sm font-medium text-primary hover:underline"
          >
            {m.common_retry()}
          </button>
        </div>
      );
    }
    return (
      <Turnstile
        key={tsAttempt}
        ref={ref}
        siteKey={siteKey}
        onToken={setToken}
        onStatus={(s) => {
          if (s === 'failed') setTsFailed(true);
        }}
      />
    );
  };

  const sendCode = async () => {
    if (!EMAIL_RE.test(email.trim())) return setError(m.auth_email_invalid());
    const g = gate();
    if (!g) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.emailStart(email.trim().toLowerCase(), name.trim(), getLocale(), g);
      setDevCode(res.devCode ?? null);
      setStep('code');
      setCode('');
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      setError(e instanceof ApiError ? errorText(e.message) : m.common_error());
    } finally {
      useToken();
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (!/^\d{6}$/.test(value)) return setError(m.auth_code_invalid());
    const g = gate();
    if (!g) return;
    setBusy(true);
    setError('');
    try {
      await api.emailVerify(email.trim().toLowerCase(), value, g);
      location.assign('/');
    } catch (e) {
      setError(e instanceof ApiError ? errorText(e.message) : m.common_error());
      setBusy(false);
    } finally {
      useToken();
    }
  };

  const devLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(m.common_required());
    const g = gate();
    if (!g) return;
    setBusy(true);
    setError('');
    try {
      await api.devLogin(name.trim(), email.trim(), g);
      location.assign('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : m.common_error());
      setBusy(false);
    } finally {
      useToken();
    }
  };

  const oauth = (provider: 'google' | 'github') => {
    const g = gate();
    if (!g) return;
    const q = new URLSearchParams({ terms: '1', ...(g.turnstile ? { turnstile: g.turnstile } : {}) });
    useToken();
    location.assign(`/api/auth/${provider}/start?${q}`);
  };

  const consentBox = (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
      <input
        type="checkbox"
        checked={accepted}
        onChange={(e) => setAccepted(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
      <span>
        {m.auth_terms_prefix()}
        <Link to="/terms" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
          {m.auth_terms_link()}
        </Link>
        {m.auth_terms_and()}
        <Link to="/privacy" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
          {m.auth_privacy_link()}
        </Link>
      </span>
    </label>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2">
          <Logo size={26} />
          <span className="text-sm font-semibold text-ink">{m.app_name()}</span>
        </span>
        <div className="flex items-center gap-2">
          <LanguageControl />
          <ThemeControl />
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pt-8 sm:items-center sm:pt-0 sm:pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <Logo size={48} className="mx-auto" />
            <h1 className="mt-4 text-2xl">{step === 'email' ? m.auth_welcome() : m.auth_code_title()}</h1>
            <p className="mt-1.5 text-sm text-muted">
              {step === 'email' ? m.auth_subtitle() : m.auth_code_sent({ email: email.trim().toLowerCase() })}
            </p>
          </div>

          <Card className="p-6">
            {step === 'email' ? (
              <>
                {hasOAuth && (
                  <div className="space-y-2.5">
                    {providerInfo?.google && (
                      <Button variant="secondary" size="lg" className="w-full justify-center" onClick={() => oauth('google')}>
                        <GoogleIcon />
                        {m.auth_google()}
                      </Button>
                    )}
                    {providerInfo?.github && (
                      <Button variant="secondary" size="lg" className="w-full justify-center" onClick={() => oauth('github')}>
                        <Github className="h-4 w-4" />
                        {m.auth_github()}
                      </Button>
                    )}
                    <div className="my-5 flex items-center gap-3 text-xs text-muted">
                      <span className="h-px flex-1 bg-line" />
                      {m.auth_or()}
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  </div>
                )}

                <form
                  onSubmit={(e) => { e.preventDefault(); sendCode(); }}
                  className="space-y-4"
                >
                  <Field label={m.auth_name()}>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={m.auth_name()} autoComplete="name" />
                  </Field>
                  <Field label={m.auth_email_label()}>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={m.auth_email_ph()}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus
                    />
                  </Field>
                  {consentBox}
                  {renderTs(tsRef)}
                  <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
                    <Mail className="h-4 w-4" />
                    {m.auth_send_code()}
                  </Button>
                </form>
                <p className="mt-4 text-center text-xs text-muted">
                  <Link to="/terms" target="_blank" rel="noreferrer" className="hover:underline">{m.auth_terms_link()}</Link>
                  {' · '}
                  <Link to="/privacy" target="_blank" rel="noreferrer" className="hover:underline">{m.auth_privacy_link()}</Link>
                </p>
              </>
            ) : (
              <div className="space-y-4">
                <Field label={m.auth_code_label()}>
                  <input
                    ref={codeRef}
                    value={code}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setCode(v);
                      if (v.length === 6) verify(v);
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="w-full rounded-xl border border-line bg-surface py-3 text-center text-2xl font-bold tracking-[0.4em] text-ink placeholder:text-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 tnum"
                  />
                </Field>

                {renderTs(tsRef)}
                <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={() => verify()}>
                  <ShieldCheck className="h-4 w-4" />
                  {m.auth_code_verify()}
                </Button>

                <p className="text-center text-xs text-muted">{m.auth_code_expire({ min: '10' })}</p>

                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => { setStep('email'); setError(''); }} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {m.auth_change_email()}
                  </button>
                  <button onClick={sendCode} disabled={busy} className="text-sm font-medium text-primary hover:underline disabled:opacity-50">
                    {m.auth_code_resend()}
                  </button>
                </div>

                <p className="border-t border-line pt-3 text-center text-xs text-muted">
                  {m.auth_code_also_link()} {m.auth_code_check_spam()}
                </p>

                {devCode && (
                  <p className="rounded-lg bg-surface2 px-3 py-2 text-center text-xs text-muted">
                    {m.auth_dev_code()}<br />
                    <span className="mt-1 inline-block font-bold tracking-[0.3em] text-ink tnum">{devCode}</span>
                  </p>
                )}
              </div>
            )}

            {error && <p className="mt-4 text-center text-sm text-red">{error}</p>}
          </Card>

          {providerInfo?.dev && (
            <div className="mt-5 text-center">
              {showDev ? (
                <form onSubmit={devLogin} className="space-y-3 rounded-2xl border border-dashed border-line p-4 text-left">
                  <p className="text-xs text-muted">{m.auth_dev_hint()}</p>
                  <Field label={m.auth_name()}>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label={m.auth_email()}>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                  </Field>
                  {consentBox}
                  {renderTs(tsDevRef)}
                  <Button type="submit" variant="secondary" className="w-full" loading={busy}>{m.auth_signin()}</Button>
                </form>
              ) : (
                <button onClick={() => setShowDev(true)} className="text-xs text-muted/70 hover:text-muted">
                  {m.auth_dev()}
                </button>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-xs text-muted">{m.app_tagline()}</p>
        </div>
      </main>
    </div>
  );
}
