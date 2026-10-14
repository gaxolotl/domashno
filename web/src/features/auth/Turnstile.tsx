// Cloudflare Turnstile widget (explicit render).
// Renders nothing when no site key is configured (bot check disabled).

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { getLocale } from '../../paraglide/runtime';

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'auto' | 'light' | 'dark';
  language?: string;
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

const Turnstile = forwardRef<TurnstileHandle, { siteKey: string | null | undefined; onToken: (t: string | null) => void }>(
  function Turnstile({ siteKey, onToken }, ref) {
    const divRef = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

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
      loadScript()
        .then(() => {
          if (!alive || !divRef.current || !window.turnstile || widgetId.current) return;
          try {
            widgetId.current = window.turnstile.render(divRef.current, {
              sitekey: siteKey,
              theme: 'auto',
              language: getLocale() === 'bg' ? 'bg' : 'en',
              callback: (t: string) => onTokenRef.current(t),
              'expired-callback': () => onTokenRef.current(null),
              'error-callback': () => onTokenRef.current(null),
            });
          } catch {
            /* widget unavailable — the form stays blocked until it loads */
          }
        })
        .catch(() => {
          /* offline / blocked CDN — token simply never arrives */
        });
      return () => {
        alive = false;
        try {
          if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      };
    }, [siteKey]);

    if (!siteKey) return null;
    return <div ref={divRef} className="flex justify-center" />;
  },
);

export default Turnstile;
