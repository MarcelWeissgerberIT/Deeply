/**
 * Reads German deadline phrases ("Freitag", "morgen", "14.11.", "in 3 Tagen",
 * "KW 46", "Ende der Woche", …) into a calendar date YYYY-MM-DD.
 * Returns null for anything it does not understand; it never guesses.
 */
import { addDays, fridayOfIsoWeek, isoWeek, startOfDay, toDateOnly } from './dates';

const WEEKDAYS: Record<string, number> = {
  sonntag: 0, so: 0,
  montag: 1, mo: 1,
  dienstag: 2, di: 2,
  mittwoch: 3, mi: 3,
  donnerstag: 4, do: 4,
  freitag: 5, fr: 5,
  samstag: 6, sa: 6,
};

const NUMBER_WORDS: Record<string, number> = {
  ein: 1, eine: 1, einer: 1, einem: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
};

function toNumber(word: string): number | null {
  if (/^\d{1,3}$/.test(word)) return Number(word);
  return NUMBER_WORDS[word] ?? null;
}

/** Next occurrence of a weekday strictly after today. */
function nextWeekday(today: Date, weekday: number): Date {
  const delta = (weekday - today.getDay() + 7) % 7 || 7;
  return addDays(today, delta);
}

/** Friday of the current working week; on weekends the coming Friday. */
function endOfWeek(today: Date): Date {
  const day = today.getDay();
  if (day === 6 || day === 0) return nextWeekday(today, 5);
  return addDays(today, 5 - day);
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function parseDeadline(text: string, now: Date): string | null {
  const today = startOfDay(now);
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return null;

  if (t === 'heute') return toDateOnly(today);
  if (t === 'morgen') return toDateOnly(addDays(today, 1));
  if (t === 'übermorgen') return toDateOnly(addDays(today, 2));

  const weekday = /^(?:(?:nächsten|nächster|kommenden|kommender|diesen|dieser) )?([a-zäöü]+)$/.exec(t);
  if (weekday && weekday[1] !== undefined && weekday[1] in WEEKDAYS) {
    return toDateOnly(nextWeekday(today, WEEKDAYS[weekday[1]]!));
  }

  if (/^(?:ende (?:der|dieser) woche|wochenende|ende woche)$/.test(t)) return toDateOnly(endOfWeek(today));
  if (/^(?:ende )?(?:nächster|nächste|kommender|kommende) woche$/.test(t)) {
    const nextMonday = nextWeekday(today, 1);
    return toDateOnly(addDays(nextMonday, 4));
  }

  if (/^(?:monatsende|ende des monats|ende monat)$/.test(t)) {
    return toDateOnly(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  }

  const relative = /^in ([a-zäöü0-9]+) (tag|tagen|woche|wochen)$/.exec(t);
  if (relative && relative[1] !== undefined && relative[2] !== undefined) {
    const n = toNumber(relative[1]);
    if (n === null || n < 1) return null;
    return toDateOnly(addDays(today, relative[2].startsWith('tag') ? n : n * 7));
  }

  const calendarWeek = /^kw ?(\d{1,2})$/.exec(t);
  if (calendarWeek && calendarWeek[1] !== undefined) {
    const week = Number(calendarWeek[1]);
    if (week < 1 || week > 53) return null;
    let friday = fridayOfIsoWeek(today.getFullYear(), week);
    if (friday < today) friday = fridayOfIsoWeek(today.getFullYear() + 1, week);
    if (isoWeek(friday) !== week) return null;
    return toDateOnly(friday);
  }

  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/.exec(t);
  if (german && german[1] !== undefined && german[2] !== undefined) {
    const day = Number(german[1]);
    const month = Number(german[2]);
    if (german[3] !== undefined) {
      const date = validDate(Number(german[3]), month, day);
      return date ? toDateOnly(date) : null;
    }
    const thisYear = validDate(today.getFullYear(), month, day);
    if (!thisYear) return null;
    return toDateOnly(thisYear < today ? (validDate(today.getFullYear() + 1, month, day) ?? thisYear) : thisYear);
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso && iso[1] !== undefined && iso[2] !== undefined && iso[3] !== undefined) {
    const date = validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return date ? toDateOnly(date) : null;
  }

  return null;
}
