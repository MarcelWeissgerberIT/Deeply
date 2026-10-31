/**
 * Wochen-Digest: replaces the status meeting with three lists:
 * done in the last seven days, endangered (red/yellow), and what waits on me.
 */
import { assess, compareByUrgency } from './ampel';
import { addDays, elapsedDays, formatDayMonth, formatDuration, isoWeek } from './dates';
import { BLOCKER_LABEL } from './labels';
import type { Assessment, Blocker, Delegation, Recipient, Settings } from './types';

export interface Digest {
  weekLabel: string;
  periodLabel: string;
  done: Delegation[];
  atRisk: { delegation: Delegation; assessment: Assessment }[];
  needsMe: Blocker[];
  /** Waiting time per blocker, e.g. "5 Std.", fixed at build time. */
  waiting: Record<string, string>;
}

const DIGEST_DAYS = 7;

export function buildDigest(delegations: Delegation[], blockers: Blocker[], now: Date, settings: Settings): Digest {
  const done = delegations
    .filter((d) => d.status === 'done' && d.doneAt !== undefined && elapsedDays(d.doneAt, now) <= DIGEST_DAYS)
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));

  const atRisk = delegations
    .map((delegation) => ({ delegation, assessment: assess(delegation, now, settings) }))
    .filter((r) => r.assessment.light === 'red' || r.assessment.light === 'yellow')
    .sort(compareByUrgency);

  const needsMe = [...blockers].sort((a, b) => a.since.localeCompare(b.since));

  return {
    weekLabel: `KW ${isoWeek(now)}`,
    periodLabel: `${formatDayMonth(addDays(now, -(DIGEST_DAYS - 1)))}–${formatDayMonth(now)}`,
    done,
    atRisk,
    needsMe,
    waiting: Object.fromEntries(needsMe.map((b) => [b.id, formatDuration(b.since, now)])),
  };
}

function nameOf(id: string, recipients: Recipient[]): string {
  const r = recipients.find((x) => x.id === id);
  if (!r) throw new Error(`Empfänger „${id}“ nicht gefunden.`);
  return r.name;
}

/** Plain text for pasting into mail or chat. */
export function digestToText(digest: Digest, recipients: Recipient[]): string {
  const red = digest.atRisk.filter((r) => r.assessment.light === 'red').length;
  const yellow = digest.atRisk.length - red;
  const lines = [
    `Wochen-Digest ${digest.weekLabel} (${digest.periodLabel})`,
    `${digest.done.length} erledigt · ${red} kritisch · ${yellow} gefährdet · ${digest.needsMe.length} ${
      digest.needsMe.length === 1 ? 'braucht' : 'brauchen'
    } mich`,
  ];
  const section = (title: string, rows: string[]) => {
    lines.push('', title, ...(rows.length ? rows : ['- nichts']));
  };
  section('Erledigt', digest.done.map((d) => `- ${d.title} (${nameOf(d.recipientId, recipients)})`));
  section(
    'Gefährdet',
    digest.atRisk.map(
      ({ delegation: d, assessment: a }) =>
        `- [${a.light === 'red' ? 'Rot' : 'Gelb'}] ${d.title} (${nameOf(d.recipientId, recipients)}): ${a.reason}`,
    ),
  );
  section(
    'Braucht mich',
    digest.needsMe.map(
      (b) => `- ${BLOCKER_LABEL[b.kind]}: ${b.title} (${nameOf(b.requestedBy, recipients)}, wartet seit ${digest.waiting[b.id]})`,
    ),
  );
  return lines.join('\n');
}
