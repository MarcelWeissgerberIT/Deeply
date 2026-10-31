/**
 * Calendar helpers for the cockpit (local time, German formatting).
 * Deadlines are calendar dates (YYYY-MM-DD); signals are ISO timestamps.
 */

const MS_PER_DAY = 86_400_000;

const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Parses YYYY-MM-DD as a local calendar date. Throws on malformed input. */
export function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Ungültiges Datum: ${value}`);
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getMonth() !== Number(m) - 1) throw new Error(`Ungültiges Datum: ${value}`);
  return date;
}

export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = startOfDay(from);
  const b = startOfDay(to);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** Elapsed time in fractional days. */
export function elapsedDays(fromIso: string, now: Date): number {
  return (now.getTime() - new Date(fromIso).getTime()) / MS_PER_DAY;
}

/** "Fr 06.11." */
export function formatShortDate(date: Date): string {
  return `${WEEKDAYS_SHORT[date.getDay()]} ${formatDayMonth(date)}`;
}

/** "in 3 T", "heute", "morgen", "vor 2 T" relative to today. */
export function formatDueRelative(due: string, now: Date): string {
  const days = calendarDaysBetween(now, parseDateOnly(due));
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days === -1) return 'gestern';
  return days > 0 ? `in ${days} T` : `vor ${-days} T`;
}

/** Elapsed time as "12 Min.", "5 Std." or "3 T". */
export function formatDuration(fromIso: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Std.`;
  return `${Math.floor(hours / 24)} T`;
}

/** "vor 2 Std.", "vor 3 T", "gerade eben". */
export function formatAgo(iso: string, now: Date): string {
  if (now.getTime() - new Date(iso).getTime() < 120_000) return 'gerade eben';
  return `vor ${formatDuration(iso, now)}`;
}

/** "25.10." */
export function formatDayMonth(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
}

/** ISO 8601 week number (Kalenderwoche). */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
}

/** Friday of the given ISO week in the given ISO year. */
export function fridayOfIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const mondayWeek1 = addDays(jan4, -((jan4.getDay() + 6) % 7));
  return addDays(mondayWeek1, (week - 1) * 7 + 4);
}

/** "1 Tag", "2 Tagen" (dative, for "seit …" and "überfällig seit …"). */
export function daysDative(n: number): string {
  return n === 1 ? '1 Tag' : `${n} Tagen`;
}
