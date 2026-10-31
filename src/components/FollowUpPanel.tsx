/**
 * Automatisches Nachfassen: friendly status requests before a delegation tips
 * over, escalation when a request stays unanswered.
 */
import { formatAgo } from '../domain/dates';
import { composeRequest, type FollowUpPlan } from '../domain/followUp';
import type { Delegation, Recipient } from '../domain/types';
import { Avatar } from './Avatar';

interface Props {
  plans: FollowUpPlan[];
  delegations: Delegation[];
  now: Date;
  recipientOf: (id: string) => Recipient;
  /** False in a read-only preview of real data: nothing may be sent to real people. */
  canSend: boolean;
  footnote: string;
  onSend: (delegationIds: string[]) => void;
  onEscalate: (delegationId: string) => void;
  onOpen: (delegationId: string) => void;
}

export function FollowUpPanel({ plans, delegations, now, recipientOf, canSend, footnote, onSend, onEscalate, onOpen }: Props) {
  const byId = new Map(delegations.map((d) => [d.id, d]));
  const asks = plans.filter((p) => p.action === 'ask');
  const escalations = plans.filter((p) => p.action === 'escalate');
  const escalating = new Set(escalations.map((p) => p.delegationId));
  const waiting = delegations.filter((d) => d.followUp?.state === 'sent' && !escalating.has(d.id));

  return (
    <section className="rail-panel" aria-labelledby="followup-title">
      <header className="rail-panel__head">
        <h2 id="followup-title">Nachfassen</h2>
        <span className="count">{plans.length}</span>
      </header>
      <p className="rail-panel__intro">
        Das Cockpit fragt freundlich nach, bevor etwas kippt. Antworten landen als Update in der Delegation.
      </p>

      {plans.length === 0 && <p className="empty">Gerade muss niemand erinnert werden.</p>}

      <ul className="followups">
        {[...escalations, ...asks].map((plan) => {
          const d = byId.get(plan.delegationId);
          if (!d) throw new Error(`Delegation „${plan.delegationId}“ fehlt für das Nachfassen.`);
          const r = recipientOf(d.recipientId);
          return (
            <li key={plan.delegationId} className="followup" data-action={plan.action}>
              <div className="followup__who">
                <Avatar recipient={r} size="sm" />
                <div className="followup__text">
                  <button type="button" className="link followup__title" onClick={() => onOpen(d.id)}>
                    {d.title}
                  </button>
                  <span className="followup__reason">
                    {r.name} · {plan.reason}
                  </span>
                </div>
              </div>
              {plan.action === 'escalate' ? (
                <div className="followup__actions">
                  <button type="button" className="btn btn--danger" onClick={() => onEscalate(d.id)}>
                    Eskalieren
                  </button>
                  <span className="followup__note">markiert Rot, ich kläre es direkt</span>
                </div>
              ) : (
                <details className="followup__message">
                  <summary>Nachricht ansehen</summary>
                  <p>{composeRequest(d, r)}</p>
                </details>
              )}
              {plan.action === 'ask' && canSend && (
                <div className="followup__actions">
                  <button type="button" className="btn" onClick={() => onSend([d.id])}>
                    Nachfrage senden
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {asks.length > 1 && canSend && (
        <button type="button" className="btn btn--primary btn--wide" onClick={() => onSend(asks.map((p) => p.delegationId))}>
          Alle {asks.length} Nachfragen senden
        </button>
      )}

      {waiting.length > 0 && (
        <>
          <h3 className="rail-panel__sub">Wartet auf Antwort</h3>
          <ul className="waiting">
            {waiting.map((d) => (
              <li key={d.id}>
                <button type="button" className="link" onClick={() => onOpen(d.id)}>
                  {d.title}
                </button>
                <span>
                  {recipientOf(d.recipientId).name} · gefragt {formatAgo(d.followUp!.sentAt, now)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="rail-panel__foot">{footnote}</p>
    </section>
  );
}
