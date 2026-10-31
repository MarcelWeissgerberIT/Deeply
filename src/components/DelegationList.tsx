/**
 * Delegations-Übersicht: one strip per delegation with recipient, deadline and
 * last sign of life, optionally grouped by Atlas tenant and project.
 */
import { formatAgo, formatDueRelative, formatShortDate, parseDateOnly } from '../domain/dates';
import { groupByWorkspace, projectLabel, type LightCounts } from '../domain/grouping';
import { KEYED_SOURCES, SOURCE_LABEL } from '../domain/labels';
import type { AssessedDelegation, Delegation, Recipient, Workspace } from '../domain/types';
import { Avatar } from './Avatar';
import { LightChip } from './LightChip';

export type Row = AssessedDelegation;

interface Props {
  rows: Row[];
  grouped: boolean;
  workspaces: Workspace[];
  now: Date;
  recipientOf: (id: string) => Recipient;
  onOpen: (id: string) => void;
  emptyText: string;
}

export function DelegationList({ rows, grouped, workspaces, now, recipientOf, onOpen, emptyText }: Props) {
  if (rows.length === 0) return <p className="empty">{emptyText}</p>;
  const strip = (row: Row, showProject: boolean) => (
    <li key={row.delegation.id}>
      <Strip
        row={row}
        now={now}
        recipient={recipientOf(row.delegation.recipientId)}
        project={showProject ? projectLabel(row.delegation.project, workspaces) : undefined}
        onOpen={onOpen}
      />
    </li>
  );

  return (
    <div className={grouped ? 'strips strips--grouped' : 'strips'}>
      <div className="strips__head" aria-hidden="true">
        <span />
        <span>Delegation</span>
        <span>Empfänger</span>
        <span>Frist</span>
        <span>Lebenszeichen</span>
      </div>
      {grouped ? (
        <div className="groups">
          {groupByWorkspace(rows, workspaces).map((group) => (
            <details key={group.workspace.slug} className="tenant" open>
              <summary className="tenant__head">
                <span className="tenant__label">Tenant</span>
                <span className="tenant__name">{group.workspace.title}</span>
                <Counts counts={group.counts} />
              </summary>
              <div className="tenant__body">
                {group.projects.map((p) => (
                  <section key={p.project.slug} className="project" aria-label={`${group.workspace.title} › ${p.project.title}`}>
                    <h3 className="project__head">
                      <span>{p.project.title}</span>
                      <Counts counts={p.counts} />
                    </h3>
                    <ul className="strips__list">{p.rows.map((row) => strip(row, false))}</ul>
                  </section>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <ul className="strips__list">{rows.map((row) => strip(row, true))}</ul>
      )}
    </div>
  );
}

function Counts({ counts }: { counts: LightCounts }) {
  const parts = (['red', 'yellow', 'green', 'done'] as const).filter((l) => counts[l] > 0);
  const words = { red: 'rot', yellow: 'gelb', green: 'grün', done: 'erledigt' };
  return (
    <span className="counts" aria-label={parts.map((l) => `${counts[l]} ${words[l]}`).join(', ')}>
      {parts.map((l) => (
        <span key={l} className="counts__item" data-light={l}>
          <span className="counts__dot" aria-hidden="true" />
          {counts[l]}
        </span>
      ))}
    </span>
  );
}

interface StripProps {
  row: Row;
  now: Date;
  recipient: Recipient;
  /** Tenant › project, shown when the list is not grouped. */
  project?: string;
  onOpen: (id: string) => void;
}

function Strip({ row, now, recipient, project, onOpen }: StripProps) {
  const { delegation: d, assessment } = row;
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
          {project && <span className="strip__project">{project}</span>}
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
        {d.due === null ? (
          <span className="strip__none">keine</span>
        ) : (
          <>
            <span className="mono">{formatShortDate(parseDateOnly(d.due))}</span>
            <span className="strip__sub">{formatDueRelative(d.due, now)}</span>
          </>
        )}
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
  if (last.actor === 'system') return 'Änderung in Atlas';
  return last.kind === 'reply' ? 'Antwort' : 'Update';
}
