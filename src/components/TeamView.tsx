/** Team & Agenten: people and AI agents side by side, with the same card and the same Ampel. */
import { useState } from 'react';
import { formatShortDate, parseDateOnly } from '../domain/dates';
import type { Blocker, Recipient, RecipientKind } from '../domain/types';
import { Avatar } from './Avatar';
import type { Row } from './DelegationList';
import { Segmented } from './Segmented';

interface Props {
  recipients: Recipient[];
  rows: Row[];
  blockers: Blocker[];
  onOpen: (delegationId: string) => void;
}

type KindFilter = 'all' | RecipientKind;

export function TeamView({ recipients, rows, blockers, onOpen }: Props) {
  const [kind, setKind] = useState<KindFilter>('all');

  const cards = recipients
    .filter((r) => kind === 'all' || r.kind === kind)
    .map((r) => {
      const own = rows.filter((row) => row.delegation.recipientId === r.id && row.assessment.light !== 'done');
      const count = (light: string) => own.filter((row) => row.assessment.light === light).length;
      return {
        recipient: r,
        open: own,
        red: count('red'),
        yellow: count('yellow'),
        green: count('green'),
        doneCount: rows.filter((row) => row.delegation.recipientId === r.id && row.assessment.light === 'done').length,
        approvals: blockers.filter((b) => b.kind === 'approval' && b.requestedBy === r.id).length,
      };
    })
    .sort((a, b) => b.red * 10 + b.yellow - (a.red * 10 + a.yellow) || a.recipient.name.localeCompare(b.recipient.name));

  return (
    <section className="view" aria-labelledby="team-title">
      <header className="view__head">
        <div>
          <h1 id="team-title">Team &amp; Agenten</h1>
          <p className="view__lead">
            Menschen und KI-Agenten in einer Liste, mit denselben Regeln. Agenten fragen vor kritischen Schritten nach meiner Freigabe.
          </p>
        </div>
        <Segmented
          label="Empfänger"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'person', label: 'Menschen' },
            { value: 'agent', label: 'Agenten' },
          ]}
        />
      </header>
      <ul className="team-grid">
        {cards.map((c) => (
          <li key={c.recipient.id} className="member" data-kind={c.recipient.kind}>
            <div className="member__head">
              <Avatar recipient={c.recipient} size="lg" />
              <div>
                <h2 className="member__name">{c.recipient.name}</h2>
                <p className="member__role">
                  {c.recipient.kind === 'agent' ? <span className="tag">Agent</span> : null} {c.recipient.role}
                </p>
              </div>
            </div>
            <div className="member__lights" aria-label="Ampel">
              <span className="light-count" data-light="red">
                <b>{c.red}</b> rot
              </span>
              <span className="light-count" data-light="yellow">
                <b>{c.yellow}</b> gelb
              </span>
              <span className="light-count" data-light="green">
                <b>{c.green}</b> grün
              </span>
              <span className="light-count" data-light="done">
                <b>{c.doneCount}</b> erledigt
              </span>
            </div>
            {c.recipient.kind === 'agent' && (
              <p className="member__gate">
                Handelt für {c.recipient.owner}. Freigabe vor kritischen Schritten ist aktiv
                {c.approvals > 0 ? `, ${c.approvals} ${c.approvals === 1 ? 'wartet' : 'warten'} auf mich.` : '.'}
              </p>
            )}
            {c.open.length > 0 ? (
              <ul className="member__list">
                {c.open.map(({ delegation: d, assessment }) => (
                  <li key={d.id}>
                    <button type="button" className="mini" data-light={assessment.light} onClick={() => onOpen(d.id)}>
                      <span className="mini__dot" aria-hidden="true" />
                      <span className="mini__title">{d.title}</span>
                      <span className="mini__due mono">{formatShortDate(parseDateOnly(d.due))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="member__empty">Nichts Offenes delegiert.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
