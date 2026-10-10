// Local-date helpers. All schedule dates are plain YYYY-MM-DD strings.

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayISO = () => isoDate(new Date());

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** ISO weekday: Monday = 1 … Sunday = 7 */
export function isoWeekday(iso: string): number {
  return ((parseISO(iso).getDay() + 6) % 7) + 1;
}

export function formatDayMonth(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'bg' ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'short' }).format(parseISO(iso));
}

export function formatFullDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'bg' ? 'bg-BG' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(parseISO(iso));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

/** First day (Monday) of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -(isoWeekday(iso) - 1));
}

export function humanSize(bytes: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
