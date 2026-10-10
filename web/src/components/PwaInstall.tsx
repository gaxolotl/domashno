import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button, cn } from './ui';
import { Logo } from './Brand';
import { m } from '../paraglide/messages';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const KEY = 'domashno:pwa-install';
const SNOOZE_DAYS = 7;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function readState(): { never: boolean; snoozeUntil: number } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { never: false, snoozeUntil: 0 };
    if (raw === 'never') return { never: true, snoozeUntil: 0 };
    const n = Number(raw);
    return { never: false, snoozeUntil: Number.isFinite(n) ? n : 0 };
  } catch {
    return { never: false, snoozeUntil: 0 };
  }
}

function writeState(value: 'never' | number) {
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    /* ignore */
  }
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [never, setNever] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const state = readState();
    if (state.never || Date.now() < state.snoozeUntil) return;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our own button
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      writeState('never');
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    if (never) writeState('never');
    else writeState(Date.now() + SNOOZE_DAYS * 864e5);
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') writeState('never');
      else dismiss();
    } catch {
      dismiss();
    } finally {
      setDeferred(null);
      setVisible(false);
    }
  };

  if (!visible || !deferred) return null;

  return (
    <div
      role="region"
      aria-label={m.pwa_title()}
      className={cn(
        'animate-pop fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md',
        'sm:bottom-6 lg:left-4 lg:right-auto lg:mx-0 lg:max-w-sm',
      )}
    >
      <div className="panel flex items-start gap-3 p-3.5 shadow-2xl">
        <Logo size={34} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{m.pwa_title()}</p>
            <button onClick={dismiss} className="-mr-1 -mt-1 grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label={m.common_close()}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-muted">{m.pwa_text()}</p>

          <div className="mt-2.5 flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={install}>
              <Download className="h-3.5 w-3.5" />
              {m.pwa_install()}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>{m.pwa_later()}</Button>
          </div>

          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-muted">
            <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--primary)]" />
            {m.pwa_never()}
          </label>
        </div>
      </div>
    </div>
  );
}
