/** Meine Blocker: everything others wait on me for, each resolvable with one click. */
import { useState } from 'react';
import { formatDuration } from '../domain/dates';
import { BLOCKER_LABEL } from '../domain/labels';
import type { Blocker, Delegation, Recipient } from '../domain/types';
import type { Resolution } from '../state/cockpit';
import { Avatar } from './Avatar';

interface Props {
  blockers: Blocker[];
  delegations: Delegation[];
  now: Date;
  recipientOf: (id: string) => Recipient;
  onResolve: (blocker: Blocker, resolution: Resolution) => void;
  onOpen: (delegationId: string) => void;
}

export function BlockerPanel({ blockers, delegations, now, recipientOf, onResolve, onOpen }: Props) {
  const sorted = [...blockers].sort((a, b) => a.since.localeCompare(b.since));
  return (
    <section className="rail-panel" aria-labelledby="blockers-title" id="blocker">
      <header className="rail-panel__head">
        <h2 id="blockers-title">Meine Blocker</h2>
        <span className="count">{blockers.length}</span>
      </header>
      <p className="rail-panel__intro">Hier warten andere auf mich. Längste Wartezeit zuerst.</p>
      {sorted.length === 0 ? (
        <p className="empty">Niemand wartet auf mich.</p>
      ) : (
        <ul className="blockers">
          {sorted.map((b) => (
            <BlockerItem
              key={b.id}
              blocker={b}
              delegation={delegations.find((d) => d.id === b.delegationId)}
              waited={formatDuration(b.since, now)}
              requester={recipientOf(b.requestedBy)}
              onResolve={onResolve}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface ItemProps {
  blocker: Blocker;
  delegation: Delegation | undefined;
  waited: string;
  requester: Recipient;
  onResolve: (blocker: Blocker, resolution: Resolution) => void;
  onOpen: (delegationId: string) => void;
}

function BlockerItem({ blocker: b, delegation, waited, requester, onResolve, onOpen }: ItemProps) {
  const [input, setInput] = useState(b.suggestedInput ?? '');
  const inputId = `blocker-input-${b.id}`;
  return (
    <li className="blocker" data-kind={b.kind}>
      <div className="blocker__top">
        <span className={`kind kind--${b.kind}`}>{BLOCKER_LABEL[b.kind]}</span>
        <span className="blocker__wait">wartet seit {waited}</span>
      </div>
      <h3 className="blocker__title">{b.title}</h3>
      <p className="blocker__detail">{b.detail}</p>
      <div className="blocker__from">
        <Avatar recipient={requester} size="sm" />
        <span>
          {requester.name}
          {delegation && (
            <>
              {' · '}
              <button type="button" className="link" onClick={() => onOpen(delegation.id)}>
                {delegation.title}
              </button>
            </>
          )}
        </span>
      </div>
      {b.kind === 'approval' && (
        <div className="blocker__actions">
          <button type="button" className="btn btn--primary" onClick={() => onResolve(b, { kind: 'approve' })}>
            Freigeben
          </button>
          <button type="button" className="btn" onClick={() => onResolve(b, { kind: 'reject' })}>
            Ablehnen
          </button>
        </div>
      )}
      {b.kind === 'decision' && (
        <div className="blocker__actions">
          {(b.options ?? []).map((option, i) => (
            <button
              key={option}
              type="button"
              className={i === 0 ? 'btn btn--primary' : 'btn'}
              onClick={() => onResolve(b, { kind: 'decide', option })}
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {b.kind === 'input' && (
        <form
          className="blocker__input"
          onSubmit={(e) => {
            e.preventDefault();
            onResolve(b, { kind: 'input', text: input });
          }}
        >
          <label className="sr-only" htmlFor={inputId}>
            Antwort an {requester.name}
          </label>
          <textarea id={inputId} rows={3} maxLength={500} value={input} onChange={(e) => setInput(e.target.value)} />
          <button type="submit" className="btn btn--primary" disabled={!input.trim()}>
            Senden
          </button>
        </form>
      )}
    </li>
  );
}
