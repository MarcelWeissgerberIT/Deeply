/** Delegations-Übersicht: one strip per delegation with recipient, deadline and last sign of life. */
import { formatAgo, formatDueRelative, formatShortDate, parseDateOnly } from '../domain/dates';
import { KEYED_SOURCES, SOURCE_LABEL } from '../domain/labels';
import type { Assessment, Delegation, Recipient } from '../domain/types';
import { Avatar } from './Avatar';
import { LightChip } from './LightChip';

export interface Row {
  delegation: Delegation;
  assessment: Assessment;
}

interface Props {
  rows: Row[];
  now: Date;
  recipientOf: (id: string) => Recipient;
  onOpen: (id: string) => void;
  emptyText: string;
}

export function DelegationList({ rows, now, recipientOf, onOpen, emptyText }: Props) {
  if (rows.length === 0) return <p className="empty">{emptyText}</p>;
  return (
    <div className="strips">
      <div className="strips__head" aria-hidden="true">
        <span />
        <span>Delegation</span>
        <span>Empfänger</span>
        <span>Frist</span>
        <span>Lebenszeichen</span>
      </div>
      <ul className="strips__list">
        {rows.map((row) => (
          <li key={row.delegation.id}>
            <Strip row={row} now={now} recipient={recipientOf(row.delegation.recipientId)} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Strip({ row, now, recipient, onOpen }: { row: Row; now: Date; recipient: Recipient; onOpen: (id: string) => void }) {
  const { delegation: d, assessment } = row;
  const due = parseDateOnly(d.due);
  const waitingForReply = d.followUp?.state === 'sent';
  return (
    <button type="button" className="strip" data-light={assessment.light} data-id={d.id} onClick={() => onOpen(d.id)}>
      <span className="strip__signal" aria-hidden="true" />
      <span className="strip__main">
        <span className="strip__title">{d.title}</span>
        <span className="strip__meta">
          <LightChip assessment={assessment} />
          {waitingForReply && <span className="tag">nachgefragt</span>}
          <span className="strip__source">
            {SOURCE_LABEL[d.source]} <span className={KEYED_SOURCES.has(d.source) ? 'mono' : undefined}>{d.sourceRef}</span>
          </span>
        </span>
      </span>
      <span className="strip__who">
        <Avatar recipient={recipient} size="sm" />
        <span className="strip__who-text">
          <span className="strip__name">{recipient.name}</span>
          <span className="strip__role">{recipient.kind === 'agent' ? 'Agent' : recipient.role}</span>
        </span>
      </span>
      <span className="strip__cell strip__cell--due">
        <span className="strip__label">Frist</span>
        <span className="mono">{formatShortDate(due)}</span>
        <span className="strip__sub">{formatDueRelative(d.due, now)}</span>
      </span>
      <span className="strip__cell strip__cell--pulse">
        <span className="strip__label">Lebenszeichen</span>
        <span>{d.status === 'done' && d.doneAt ? formatAgo(d.doneAt, now) : formatAgo(d.lastSignalAt, now)}</span>
        <span className="strip__sub">{d.status === 'done' ? 'erledigt' : lastSignalKind(d)}</span>
      </span>
    </button>
  );
}

function lastSignalKind(d: Delegation): string {
  const last = [...d.events].reverse().find((e) => e.actor !== 'me');
  if (!last) return 'noch keins';
  return last.kind === 'reply' ? 'Antwort' : 'Update';
}
