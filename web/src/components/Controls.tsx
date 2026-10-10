import { Moon, Sun, Monitor, Languages } from 'lucide-react';
import { cn } from './ui';
import { useTheme, type ThemePref } from '../lib/theme';
import { getLocale, setLocale } from '../paraglide/runtime';

const THEMES: { value: ThemePref; icon: typeof Sun; label: string }[] = [
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
];

export function ThemeControl({ className }: { className?: string }) {
  const { pref, setPref } = useTheme();
  return (
    <div className={cn('inline-flex rounded-xl border border-line bg-surface p-0.5', className)}>
      {THEMES.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setPref(value)}
          title={label}
          aria-label={label}
          aria-pressed={pref === value}
          className={cn(
            'grid h-7 w-7 place-items-center rounded-[9px] transition-colors',
            pref === value ? 'bg-primary-soft text-primary' : 'text-muted hover:text-ink',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export function LanguageControl({ className }: { className?: string }) {
  const locale = getLocale();
  return (
    <button
      onClick={() => setLocale(locale === 'bg' ? 'en' : 'bg')}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-sm font-medium text-muted transition-colors hover:text-ink',
        className,
      )}
      title="Език / Language"
    >
      <Languages className="h-4 w-4" />
      {locale === 'bg' ? 'БГ' : 'EN'}
    </button>
  );
}
