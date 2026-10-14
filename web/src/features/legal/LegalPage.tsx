// Public Terms of Service / Privacy Policy page (no login required).

import { Fragment, type ReactNode } from 'react';
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

const linkClass = 'font-medium text-primary hover:underline';

/** Render `[text](https://…)` as real links. Everything else stays plain text. */
function renderLinks(text: string, keyPrefix: string): ReactNode[] {
  const re = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let mt: RegExpExecArray | null;
  while ((mt = re.exec(text)) !== null) {
    if (mt.index > last) out.push(text.slice(last, mt.index));
    out.push(
      <a key={`${keyPrefix}-l${i++}`} href={mt[2]} target="_blank" rel="noreferrer" className={linkClass}>
        {mt[1]}
      </a>,
    );
    last = mt.index + mt[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function LegalPage({ doc }: { doc: 'terms' | 'privacy' }) {
  const locale = getLocale() === 'en' ? 'en' : 'bg';
  const { data: config } = useConfig();
  const d = legal[locale][doc];
  const title = doc === 'terms' ? m.legal_terms_title() : m.legal_privacy_title();

  const contactNode: ReactNode = config?.legalContact ? (
    <a href={`mailto:${config.legalContact}`} className={linkClass}>
      {config.legalContact}
    </a>
  ) : (
    <span>{contactFallback(locale)}</span>
  );

  // Fill `{contact}` and render `[text](url)` links.
  const fill = (s: string, keyPrefix: string): ReactNode[] =>
    s.split('{contact}').flatMap((part, i, arr) =>
      i < arr.length - 1
        ? [...renderLinks(part, `${keyPrefix}-p${i}`), <Fragment key={`${keyPrefix}-c${i}`}>{contactNode}</Fragment>]
        : renderLinks(part, `${keyPrefix}-p${i}`),
    );

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
              <p key={i}>{fill(p, `intro-${i}`)}</p>
            ))}
          </div>

          {d.sections.map((s, i) => (
            <section key={i} className="mt-7">
              <h2 className="text-lg font-semibold text-ink">{s.heading}</h2>
              <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink">
                {s.paragraphs.map((p, j) => (
                  <p key={j}>{fill(p, `s${i}-p${j}`)}</p>
                ))}
              </div>
              {s.bullets && (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink">
                  {s.bullets.map((b, j) => (
                    <li key={j}>{fill(b, `s${i}-b${j}`)}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="mt-7 space-y-3 border-t border-line pt-5 text-[15px] leading-relaxed text-ink">
            {d.outro.map((p, i) => (
              <p key={i}>{fill(p, `outro-${i}`)}</p>
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
