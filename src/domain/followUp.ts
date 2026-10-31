/**
 * Automatic follow-up: decides whom to ask for a status before a delegation
 * tips over, and when an unanswered request becomes an escalation.
 */
import {
  calendarDaysBetween,
  daysDative,
  elapsedDays,
  formatAgo,
  formatDueRelative,
  formatShortDate,
  parseDateOnly,
} from './dates';
import type { Delegation, Recipient, Settings } from './types';

export interface FollowUpPlan {
  delegationId: string;
  action: 'ask' | 'escalate';
  reason: string;
}

/** Days to wait for an answer before proposing an escalation. */
const ANSWER_WINDOW_DAYS = 1;
/** Deadlines this close get a request even before the item turns yellow. */
const DEADLINE_WINDOW_DAYS = 2;

function planFor(d: Delegation, now: Date, settings: Settings): FollowUpPlan | null {
  if (d.status === 'done' || d.status === 'blocked' || d.status === 'waiting-approval') return null;
  if (d.followUp?.state === 'escalated') return null;

  if (d.followUp?.state === 'sent') {
    const waited = elapsedDays(d.followUp.sentAt, now);
    const answered = new Date(d.lastSignalAt) > new Date(d.followUp.sentAt);
    if (answered || waited < ANSWER_WINDOW_DAYS) return null;
    return { delegationId: d.id, action: 'escalate', reason: `keine Antwort seit ${Math.floor(waited)} T` };
  }

  const daysToDue = calendarDaysBetween(now, parseDateOnly(d.due));
  if (daysToDue < 0) return { delegationId: d.id, action: 'ask', reason: `überfällig seit ${daysDative(-daysToDue)}` };

  const silent = elapsedDays(d.lastSignalAt, now);
  if (silent >= settings.staleDays) {
    return { delegationId: d.id, action: 'ask', reason: `seit ${daysDative(Math.floor(silent))} ohne Update` };
  }
  if (silent >= settings.staleDays - 1) return { delegationId: d.id, action: 'ask', reason: 'kippt morgen auf Gelb' };
  if (daysToDue <= DEADLINE_WINDOW_DAYS && silent >= 1) {
    return {
      delegationId: d.id,
      action: 'ask',
      reason: `fällig ${formatDueRelative(d.due, now)}, letztes Update ${formatAgo(d.lastSignalAt, now)}`,
    };
  }
  return null;
}

export function planFollowUps(delegations: Delegation[], now: Date, settings: Settings): FollowUpPlan[] {
  const dueOf = new Map(delegations.map((d) => [d.id, d.due]));
  return delegations
    .map((d) => planFor(d, now, settings))
    .filter((p): p is FollowUpPlan => p !== null)
    .sort((a, b) => {
      if (a.action !== b.action) return a.action === 'escalate' ? -1 : 1;
      return (dueOf.get(a.delegationId) ?? '').localeCompare(dueOf.get(b.delegationId) ?? '');
    });
}

/** The status request the cockpit sends on my behalf. */
export function composeRequest(d: Delegation, recipient: Recipient): string {
  const due = formatShortDate(parseDateOnly(d.due));
  if (recipient.kind === 'agent') {
    return `Statusabfrage an ${recipient.name}: Bitte Fortschritt, nächsten Schritt und offene Freigaben zu „${d.title}“ melden (fällig ${due}).`;
  }
  const firstName = recipient.name.split(' ')[0];
  return `Hallo ${firstName}, kurze Nachfrage zu „${d.title}“ (fällig ${due}): Wie ist der Stand, und brauchst du etwas von mir? Ein Satz als Antwort reicht, er landet direkt als Update im Cockpit. Danke!`;
}
