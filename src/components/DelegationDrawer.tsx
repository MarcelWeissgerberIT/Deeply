/** Detail of one delegation: facts, Ampel reason, follow-up action and the full timeline (audit trail). */
import { useEffect, useRef } from 'react';
import { formatAgo, formatShortDate, parseDateOnly } from '../domain/dates';
import { KEYED_SOURCES, SOURCE_LABEL, STATUS_LABEL } from '../domain/labels';
import type { Assessment, Delegation, EventKind, Recipient } from '../domain/types';
import { Avatar } from './Avatar';
import { LightChip } from './LightChip';

const EVENT_LABEL: Record<EventKind, string> = {
  created: 'Delegiert',
  update: 'Update',
  'follow-up': 'Nachfrage',
  reply: 'Antwort',
  escalation: 'Eskalation',
  approved: 'Freigabe',
  rejected: 'Abgelehnt',
  decision: 'Entscheidung',
  input: 'Input',
  done: 'Erledigt',
};

interface Props {
  delegation: Delegation;
  assessment: Assessment;
  now: Date;
  recipientOf: (id: string) => Recipient;
  canAsk: boolean;
  onAsk: (delegationId: string) => void;
  onClose: () => void;
}

export function DelegationDrawer({ delegation: d, assessment, now, recipientOf, canAsk, onAsk, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const recipient = recipientOf(d.recipientId);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const actorName = (actor: string) => (actor === 'me' ? 'Ich' : recipientOf(actor).name);

  return (
    <div className="drawer-layer">
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer__head">
          <LightChip assessment={assessment} />
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Schließen">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </header>
        <h2 id="drawer-title" className="drawer__title">
          {d.title}
        </h2>
        <dl className="facts">
          <div>
            <dt>Empfänger</dt>
            <dd className="facts__who">
              <Avatar recipient={recipient} size="sm" />
              <span>
                {recipient.name}
                <small>{recipient.kind === 'agent' ? `Agent · ${recipient.role} · handelt für ${recipient.owner}` : recipient.role}</small>
              </span>
            </dd>
          </div>
          <div>
            <dt>Frist</dt>
            <dd className="mono">{formatShortDate(parseDateOnly(d.due))}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{STATUS_LABEL[d.status]}</dd>
          </div>
          <div>
            <dt>Lebenszeichen</dt>
            <dd>{formatAgo(d.lastSignalAt, now)}</dd>
          </div>
          <div>
            <dt>Quelle</dt>
            <dd>
              {SOURCE_LABEL[d.source]} <span className={KEYED_SOURCES.has(d.source) ? 'mono' : undefined}>{d.sourceRef}</span>
            </dd>
          </div>
          {d.context && (
            <div className="facts__wide">
              <dt>Kontext</dt>
              <dd>{d.context}</dd>
            </div>
          )}
        </dl>

        {canAsk && (
          <button type="button" className="btn btn--primary btn--wide" onClick={() => onAsk(d.id)}>
            Nachfrage an {recipient.name.split(' ')[0]} senden
          </button>
        )}
        {d.followUp?.state === 'sent' && <p className="drawer__note">Nachfrage gesendet {formatAgo(d.followUp.sentAt, now)}, wartet auf Antwort.</p>}

        <h3 className="drawer__sub">Verlauf</h3>
        <ol className="timeline">
          {[...d.events].reverse().map((e, i) => (
            <li key={`${e.at}-${i}`} data-kind={e.kind}>
              <div className="timeline__meta">
                <span className="timeline__kind">{EVENT_LABEL[e.kind]}</span>
                <span>{actorName(e.actor)}</span>
                <time dateTime={e.at}>{formatAgo(e.at, now)}</time>
              </div>
              <p>{e.text}</p>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
