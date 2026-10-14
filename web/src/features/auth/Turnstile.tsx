// Cloudflare Turnstile widget (explicit render).
// Renders nothing when no site key is configured (bot check disabled).
// Reports loading trouble via onStatus so the page can show a retry
// instead of an invisible empty box (e.g. when a blocker stops the CDN).

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'auto' | 'light' | 'dark';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

interface TurnstileApi {
  render(el: HTMLElement, opts: TurnstileRenderOptions): string;
  reset(id?: string): void;
  remove(id?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('turnstile script failed'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export interface TurnstileHandle {
  reset: () => void;
}

export type TurnstileStatus = 'loading' | 'ready' | 'failed';

const Turnstile = forwardRef<
  TurnstileHandle,
  { siteKey: string | null | undefined; onToken: (t: string | null) => void; onStatus?: (s: TurnstileStatus) => void }
>(function Turnstile({ siteKey, onToken, onStatus }, ref) {
  const divRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const statusRef = useRef<TurnstileStatus>('loading');
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  const setStatus = (s: TurnstileStatus) => {
    statusRef.current = s;
    onStatusRef.current?.(s);
  };

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        try {
          if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
        } catch {
          /* ignore */
        }
        onTokenRef.current(null);
      },
    }),
    [],
  );

  useEffect(() => {
    if (!siteKey) return;
    let alive = true;
    statusRef.current = 'loading';
    onStatusRef.current?.('loading');
    // If the script hangs (no load, no error), say so after a while.
    const watchdog = setTimeout(() => {
      if (alive && statusRef.current === 'loading') setStatus('failed');
    }, 15000);
    loadScript()
      .then(() => {
        if (!alive || !divRef.current || !window.turnstile || widgetId.current) return;
        try {
          widgetId.current = window.turnstile.render(divRef.current, {
            sitekey: siteKey,
            theme: 'auto',
            callback: (t: string) => onTokenRef.current(t),
            'expired-callback': () => onTokenRef.current(null),
            'error-callback': () => onTokenRef.current(null),
          });
          setStatus('ready');
        } catch {
          setStatus('failed');
        }
      })
      .catch(() => {
        if (alive) setStatus('failed');
      });
    return () => {
      alive = false;
      clearTimeout(watchdog);
      try {
        if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      } catch {
        /* ignore */
      }
      widgetId.current = null;
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={divRef} className="flex min-h-[65px] items-center justify-center" />;
});

export default Turnstile;
