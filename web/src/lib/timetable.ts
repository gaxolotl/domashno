import type { Slot } from './api';
import { isoDate, isoWeekday, parseISO, addDays } from './dates';

/** Lessons of `subjectId` on a given ISO weekday (1=Mon … 7=Sun), sorted by period. */
export function lessonsOn(schedule: Slot[], subjectId: string | null, weekday: number): Slot[] {
  if (!subjectId) return [];
  return schedule
    .filter((s) => s.subject_id === subjectId && s.day === weekday)
    .sort((a, b) => a.period - b.period);
}

/** Which ISO weekdays (1–7) a subject is taught on. */
export function subjectWeekdays(schedule: Slot[], subjectId: string | null): Set<number> {
  const set = new Set<number>();
  if (!subjectId) return set;
  for (const s of schedule) if (s.subject_id === subjectId) set.add(s.day);
  return set;
}

/** First date (>= today, inclusive) on which the subject has a lesson. */
export function nextLessonDate(schedule: Slot[], subjectId: string | null, fromISO: string): string | null {
  if (!subjectId || !schedule.length) return null;
  let date = fromISO;
  for (let i = 0; i < 90; i++) {
    if (lessonsOn(schedule, subjectId, isoWeekday(date)).length > 0) return date;
    date = addDays(date, 1);
  }
  return null;
}

/**
 * First date strictly after `afterISO` on which the subject has a lesson.
 * "Homework for the next lesson" is due at the *following* occurrence of the
 * subject, not on a day it was already taught.
 */
export function nextLessonAfter(schedule: Slot[], subjectId: string | null, afterISO: string): string | null {
  return nextLessonDate(schedule, subjectId, addDays(afterISO, 1));
}

export function isWeekend(iso: string): boolean {
  return isoWeekday(iso) >= 6;
}

/** All dates in a month grid (Monday-first), including leading/trailing padding. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon=0
  const start = new Date(year, month, 1 - startOffset);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(isoDate(d));
  }
  return cells;
}

export const monthLabel = (year: number, month: number, locale: string) =>
  new Intl.DateTimeFormat(locale === 'bg' ? 'bg-BG' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));

/** Short weekday headers, Monday first. */
export function weekdayHeaders(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale === 'bg' ? 'bg-BG' : 'en-GB', { weekday: 'short' });
  const base = new Date(2024, 0, 1); // a Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return fmt.format(d).replace('.', '');
  });
}

export const formatLessonTime = (slot: Slot) => (slot.start && slot.end ? `${slot.start}–${slot.end}` : '');

export const sameDay = (a: string, b: string) => a === b;
export const monthOf = (iso: string) => {
  const d = parseISO(iso);
  return { year: d.getFullYear(), month: d.getMonth() };
};
