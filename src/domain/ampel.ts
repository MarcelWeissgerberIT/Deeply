/**
 * Ampel: classifies a delegation as red, yellow, green or done.
 * Red = overdue, blocked or escalated. Yellow = silent for X days or waiting
 * for my approval. Everything else is green.
 */
import { calendarDaysBetween, daysDative, elapsedDays, formatDueRelative, parseDateOnly } from './dates';
import type { Assessment, Delegation, Settings } from './types';

export function assess(d: Delegation, now: Date, settings: Settings): Assessment {
  if (d.status === 'done') return { light: 'done', reason: 'erledigt' };

  if (d.status === 'blocked') {
    return { light: 'red', reason: d.blockedReason ? `blockiert: ${d.blockedReason}` : 'blockiert' };
  }

  const daysToDue = calendarDaysBetween(now, parseDateOnly(d.due));
  if (daysToDue < 0) return { light: 'red', reason: `überfällig seit ${daysDative(-daysToDue)}` };

  if (d.followUp?.state === 'escalated') {
    return { light: 'red', reason: 'eskaliert: keine Antwort auf Nachfrage' };
  }

  if (d.status === 'waiting-approval') return { light: 'yellow', reason: 'wartet auf meine Freigabe' };

  const silent = Math.floor(elapsedDays(d.lastSignalAt, now));
  if (silent >= settings.staleDays) return { light: 'yellow', reason: `seit ${daysDative(silent)} ohne Update` };

  if (daysToDue <= 2) return { light: 'green', reason: `fällig ${formatDueRelative(d.due, now)}` };
  return { light: 'green', reason: 'läuft' };
}

/** Exceptions are what the default view shows: red and yellow. */
export function isException(a: Assessment): boolean {
  return a.light === 'red' || a.light === 'yellow';
}

const LIGHT_ORDER = { red: 0, yellow: 1, green: 2, done: 3 } as const;

/** Sort key: red before yellow before green, then nearest deadline first. */
export function compareByUrgency(
  a: { delegation: Delegation; assessment: Assessment },
  b: { delegation: Delegation; assessment: Assessment },
): number {
  const byLight = LIGHT_ORDER[a.assessment.light] - LIGHT_ORDER[b.assessment.light];
  return byLight !== 0 ? byLight : a.delegation.due.localeCompare(b.delegation.due);
}
