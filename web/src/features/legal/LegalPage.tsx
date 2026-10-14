// Public Terms of Service / Privacy Policy page (no login required).

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../../components/ui';
import { Logo } from '../../components/Brand';
import { LanguageControl, ThemeControl } from '../../components/Controls';
import { useConfig } from '../../lib/hooks';
import { getLocale } from '../../paraglide/runtime';
import { m } from '../../paraglide/messages';
import { legal } from './legalContent';

function contactFallback(locale: string) {
  return locale === 'bg'
    ? 'администратора на този сървър (човека, който поддържа тази инсталация)'
    : 'the administrator of this server (the person running this installation)';
}

export default function LegalPage({ doc }: { doc: 'terms' | 'privacy' }) {
  const locale = getLocale() === 'en' ? 'en' : 'bg';
  const { data: config } = useConfig();
  const contact = config?.legalContact || contactFallback(locale);
  const d = legal[locale][doc];
  const fill = (s: string) => s.replaceAll('{contact}', contact);
  const title = doc === 'terms' ? m.legal_terms_title() : m.legal_privacy_title();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={26} />
          <span className="text-sm font-semibold text-ink">{m.app_name()}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageControl />
          <ThemeControl />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {m.legal_back()}
        </Link>

        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-muted">{m.legal_updated({ date: d.updated })}</p>

          <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink">
            {d.intro.map((p, i) => (
              <p key={i}>{fill(p)}</p>
            ))}
          </div>

          {d.sections.map((s, i) => (
            <section key={i} className="mt-7">
              <h2 className="text-lg font-semibold text-ink">{s.heading}</h2>
              <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink">
                {s.paragraphs.map((p, j) => (
                  <p key={j}>{fill(p)}</p>
                ))}
              </div>
              {s.bullets && (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink">
                  {s.bullets.map((b, j) => (
                    <li key={j}>{fill(b)}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="mt-7 space-y-3 border-t border-line pt-5 text-[15px] leading-relaxed text-ink">
            {d.outro.map((p, i) => (
              <p key={i}>{fill(p)}</p>
            ))}
          </div>
        </Card>

        <p className="mt-6 text-center text-xs text-muted">
          <Link to="/terms" className="hover:underline">
            {m.auth_terms_link()}
          </Link>
          {' · '}
          <Link to="/privacy" className="hover:underline">
            {m.auth_privacy_link()}
          </Link>
        </p>
      </main>
    </div>
  );
}
