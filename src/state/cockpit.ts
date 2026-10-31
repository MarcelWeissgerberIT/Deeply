/**
 * Cockpit state and its transitions. Pure reducer: every action carries its
 * own timestamp, so the same input always gives the same state.
 * Invalid actions throw with a German message; nothing fails silently.
 */
import type { DelegationDraft } from '../domain/parseDelegation';
import type { Blocker, Delegation, EventKind, Recipient, Settings, Workspace } from '../domain/types';
import { BLOCKER_LABEL } from '../domain/labels';

export interface CockpitState {
  workspaces: Workspace[];
  recipients: Recipient[];
  delegations: Delegation[];
  blockers: Blocker[];
  settings: Settings;
}

export type Resolution =
  | { kind: 'approve' }
  | { kind: 'reject' }
  | { kind: 'decide'; option: string }
  | { kind: 'input'; text: string };

export type CockpitAction =
  | { type: 'delegate'; id: string; draft: DelegationDraft; project: string; now: string }
  | { type: 'followUpSent'; delegationId: string; message: string; now: string }
  | { type: 'replyReceived'; delegationId: string; text: string; now: string }
  | { type: 'escalate'; delegationId: string; now: string }
  | { type: 'resolveBlocker'; blockerId: string; resolution: Resolution; now: string }
  | { type: 'setStaleDays'; days: number };

export const MAX_INPUT_LENGTH = 500;

const ALLOWED: Record<Blocker['kind'], Resolution['kind'][]> = {
  approval: ['approve', 'reject'],
  decision: ['decide'],
  input: ['input'],
};

function findDelegation(state: CockpitState, id: string): Delegation {
  const d = state.delegations.find((x) => x.id === id);
  if (!d) throw new Error(`Delegation „${id}“ nicht gefunden.`);
  return d;
}

function replaceDelegation(state: CockpitState, next: Delegation): CockpitState {
  return { ...state, delegations: state.delegations.map((d) => (d.id === next.id ? next : d)) };
}

function withEvent(d: Delegation, at: string, kind: EventKind, actor: string, text: string): Delegation {
  return { ...d, events: [...d.events, { at, kind, actor, text }] };
}

function resolveBlocker(state: CockpitState, blockerId: string, resolution: Resolution, now: string): CockpitState {
  const blocker = state.blockers.find((b) => b.id === blockerId);
  if (!blocker) throw new Error(`Blocker „${blockerId}“ nicht gefunden.`);
  if (!ALLOWED[blocker.kind].includes(resolution.kind)) {
    const article = blocker.kind === 'input' ? 'einem' : 'einer';
    throw new Error(`Diese Aktion passt nicht zu ${article} ${BLOCKER_LABEL[blocker.kind]}.`);
  }

  let kind: EventKind;
  let text: string;
  switch (resolution.kind) {
    case 'approve':
      kind = 'approved';
      text = `Freigegeben: ${blocker.title}`;
      break;
    case 'reject':
      kind = 'rejected';
      text = `Abgelehnt: ${blocker.title}`;
      break;
    case 'decide':
      if (!blocker.options?.includes(resolution.option)) {
        throw new Error(`Option „${resolution.option}“ gehört nicht zu dieser Entscheidung.`);
      }
      kind = 'decision';
      text = `Entschieden: ${resolution.option}`;
      break;
    case 'input': {
      const value = resolution.text.trim();
      if (!value) throw new Error('Der Input ist leer.');
      if (value.length > MAX_INPUT_LENGTH) throw new Error(`Der Input ist zu lang (höchstens ${MAX_INPUT_LENGTH} Zeichen).`);
      kind = 'input';
      text = `Input geliefert: ${value}`;
      break;
    }
  }

  const remaining = { ...state, blockers: state.blockers.filter((b) => b.id !== blockerId) };
  if (!blocker.delegationId) return remaining;

  const d = findDelegation(state, blocker.delegationId);
  let status = d.status;
  if (resolution.kind === 'approve' && d.status === 'waiting-approval') status = 'in-progress';
  if (resolution.kind === 'reject' && d.status === 'waiting-approval') status = 'open';
  if ((resolution.kind === 'decide' || resolution.kind === 'input') && d.status === 'blocked') status = 'in-progress';

  const next: Delegation = { ...withEvent(d, now, kind, 'me', text), status, lastSignalAt: now };
  if (status !== 'blocked') delete next.blockedReason;
  return replaceDelegation(remaining, next);
}

export function cockpitReducer(state: CockpitState, action: CockpitAction): CockpitState {
  switch (action.type) {
    case 'delegate': {
      const { draft, id, project, now } = action;
      if (!state.recipients.some((r) => r.id === draft.recipientId)) {
        throw new Error(`Empfänger „${draft.recipientId}“ nicht gefunden.`);
      }
      if (!state.workspaces.some((w) => w.projects.some((p) => p.slug === project))) {
        throw new Error(`Projekt „${project}“ nicht gefunden.`);
      }
      const created: Delegation = {
        id,
        title: draft.title,
        recipientId: draft.recipientId,
        project,
        source: 'atlas',
        sourceRef: 'neu',
        createdAt: now,
        due: draft.due,
        status: 'open',
        lastSignalAt: now,
        events: [{ at: now, kind: 'created', actor: 'me', text: 'Delegiert per Satz, in Atlas angelegt' }],
      };
      if (draft.context) created.context = draft.context;
      return { ...state, delegations: [created, ...state.delegations] };
    }

    case 'followUpSent': {
      const d = findDelegation(state, action.delegationId);
      const next = withEvent(d, action.now, 'follow-up', 'me', action.message);
      return replaceDelegation(state, { ...next, followUp: { state: 'sent', sentAt: action.now } });
    }

    case 'replyReceived': {
      const d = findDelegation(state, action.delegationId);
      if (!d.followUp) throw new Error(`Zu „${d.title}“ gibt es keine offene Nachfrage.`);
      const next = withEvent(d, action.now, 'reply', d.recipientId, action.text);
      return replaceDelegation(state, {
        ...next,
        lastSignalAt: action.now,
        followUp: { state: 'answered', sentAt: d.followUp.sentAt },
      });
    }

    case 'escalate': {
      const d = findDelegation(state, action.delegationId);
      if (!d.followUp) throw new Error(`Zu „${d.title}“ gibt es keine Nachfrage, die eskaliert werden kann.`);
      const next = withEvent(d, action.now, 'escalation', 'me', 'Eskaliert: keine Antwort auf die Nachfrage. Ich kläre es direkt.');
      return replaceDelegation(state, { ...next, followUp: { state: 'escalated', sentAt: d.followUp.sentAt } });
    }

    case 'resolveBlocker':
      return resolveBlocker(state, action.blockerId, action.resolution, action.now);

    case 'setStaleDays': {
      if (!Number.isInteger(action.days) || action.days < 1 || action.days > 14) {
        throw new Error('Die Schwelle muss zwischen 1 und 14 Tagen liegen.');
      }
      return { ...state, settings: { ...state.settings, staleDays: action.days } };
    }
  }
}
