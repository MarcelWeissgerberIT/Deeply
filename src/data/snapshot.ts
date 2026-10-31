/**
 * Data source selection. The public build ships demo data only. A private
 * build can embed a snapshot of real Atlas data as
 * <script type="application/json" id="cockpit-snapshot">; it is validated
 * here, at the system boundary, and rejected loudly when malformed.
 * Real data never lives in this repository.
 */
import { parseDelegation } from '../domain/parseDelegation';
import type {
  Blocker,
  BlockerKind,
  Delegation,
  DelegationStatus,
  EventKind,
  FollowUpState,
  Recipient,
  Source,
  TimelineEvent,
  Workspace,
} from '../domain/types';
import type { CockpitState } from '../state/cockpit';
import { createDemoState } from './demo';

export type DataInfo = { kind: 'demo' } | { kind: 'snapshot'; takenAt: string };

export const SNAPSHOT_ELEMENT_ID = 'cockpit-snapshot';

const MAX_TEXT = 500;
const MAX_ITEMS = 2000;

const SOURCES: readonly Source[] = ['atlas', 'jira', 'polarion', 'mail', 'meeting'];
const STATUSES: readonly DelegationStatus[] = ['open', 'in-progress', 'blocked', 'waiting-approval', 'done'];
const EVENT_KINDS: readonly EventKind[] = [
  'created',
  'update',
  'follow-up',
  'reply',
  'escalation',
  'approved',
  'rejected',
  'decision',
  'input',
  'done',
];
const FOLLOW_UP_STATES: readonly FollowUpState[] = ['sent', 'answered', 'escalated'];
const BLOCKER_KINDS: readonly BlockerKind[] = ['approval', 'decision', 'input'];

type Obj = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(message);
}

function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${path} muss ein Objekt sein.`);
  return value as Obj;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(`${path} muss eine Liste sein.`);
  if (value.length > MAX_ITEMS) fail(`${path} hat zu viele Einträge (höchstens ${MAX_ITEMS}).`);
  return value;
}

function text(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string') fail(`${path} muss Text sein.`);
  if (!allowEmpty && value.trim() === '') fail(`${path} darf nicht leer sein.`);
  if (value.length > MAX_TEXT) fail(`${path} ist zu lang (höchstens ${MAX_TEXT} Zeichen).`);
  return value;
}

function optionalText(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : text(value, path);
}

function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) fail(`${path} hat einen unbekannten Wert: ${String(value)}`);
  return value as T;
}

function timestamp(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    fail(`${path} muss ein ISO-Zeitstempel sein.`);
  }
  return value;
}

function optionalTimestamp(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : timestamp(value, path);
}

function dateOrNull(value: unknown, path: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${path} muss YYYY-MM-DD oder null sein.`);
  return value;
}

function unique(ids: string[], path: string): Set<string> {
  const set = new Set(ids);
  if (set.size !== ids.length) fail(`${path} enthält doppelte IDs.`);
  return set;
}

function parseWorkspaces(value: unknown): Workspace[] {
  return list(value, 'workspaces').map((raw, i) => {
    const w = obj(raw, `workspaces[${i}]`);
    return {
      slug: text(w.slug, `workspaces[${i}].slug`),
      title: text(w.title, `workspaces[${i}].title`),
      projects: list(w.projects, `workspaces[${i}].projects`).map((rawP, j) => {
        const p = obj(rawP, `workspaces[${i}].projects[${j}]`);
        return { slug: text(p.slug, `workspaces[${i}].projects[${j}].slug`), title: text(p.title, `workspaces[${i}].projects[${j}].title`) };
      }),
    };
  });
}

function parseRecipients(value: unknown): Recipient[] {
  return list(value, 'recipients').map((raw, i) => {
    const r = obj(raw, `recipients[${i}]`);
    const recipient: Recipient = {
      id: text(r.id, `recipients[${i}].id`),
      name: text(r.name, `recipients[${i}].name`),
      kind: oneOf(r.kind, `recipients[${i}].kind`, ['person', 'agent'] as const),
      role: text(r.role, `recipients[${i}].role`, true),
    };
    const owner = optionalText(r.owner, `recipients[${i}].owner`);
    if (owner !== undefined) recipient.owner = owner;
    return recipient;
  });
}

function parseEvent(raw: unknown, path: string, actors: Set<string>): TimelineEvent {
  const e = obj(raw, path);
  const actor = text(e.actor, `${path}.actor`);
  if (actor !== 'me' && actor !== 'system' && !actors.has(actor)) fail(`${path}.actor verweist auf unbekannten Empfänger „${actor}“.`);
  return { at: timestamp(e.at, `${path}.at`), kind: oneOf(e.kind, `${path}.kind`, EVENT_KINDS), actor, text: text(e.text, `${path}.text`) };
}

function parseDelegationRecord(raw: unknown, i: number, recipients: Set<string>, projects: Set<string>): Delegation {
  const path = `delegations[${i}]`;
  const d = obj(raw, path);
  const recipientId = text(d.recipientId, `${path}.recipientId`);
  if (!recipients.has(recipientId)) fail(`${path}.recipientId verweist auf unbekannten Empfänger „${recipientId}“.`);
  const project = text(d.project, `${path}.project`);
  if (!projects.has(project)) fail(`${path}.project verweist auf unbekanntes Projekt „${project}“.`);

  const delegation: Delegation = {
    id: text(d.id, `${path}.id`),
    title: text(d.title, `${path}.title`),
    recipientId,
    project,
    source: oneOf(d.source, `${path}.source`, SOURCES),
    sourceRef: text(d.sourceRef, `${path}.sourceRef`),
    due: dateOrNull(d.due, `${path}.due`),
    status: oneOf(d.status, `${path}.status`, STATUSES),
    lastSignalAt: timestamp(d.lastSignalAt, `${path}.lastSignalAt`),
    events: list(d.events, `${path}.events`).map((e, j) => parseEvent(e, `${path}.events[${j}]`, recipients)),
  };
  const optional = {
    sourceStatus: optionalText(d.sourceStatus, `${path}.sourceStatus`),
    context: optionalText(d.context, `${path}.context`),
    blockedReason: optionalText(d.blockedReason, `${path}.blockedReason`),
    createdAt: optionalTimestamp(d.createdAt, `${path}.createdAt`),
    doneAt: optionalTimestamp(d.doneAt, `${path}.doneAt`),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) (delegation as unknown as Obj)[key] = value;
  }
  if (d.followUp !== undefined) {
    const f = obj(d.followUp, `${path}.followUp`);
    delegation.followUp = {
      state: oneOf(f.state, `${path}.followUp.state`, FOLLOW_UP_STATES),
      sentAt: timestamp(f.sentAt, `${path}.followUp.sentAt`),
    };
  }
  return delegation;
}

function parseBlocker(raw: unknown, i: number, recipients: Set<string>, delegations: Set<string>): Blocker {
  const path = `blockers[${i}]`;
  const b = obj(raw, path);
  const requestedBy = text(b.requestedBy, `${path}.requestedBy`);
  if (!recipients.has(requestedBy)) fail(`${path}.requestedBy verweist auf unbekannten Empfänger „${requestedBy}“.`);
  const blocker: Blocker = {
    id: text(b.id, `${path}.id`),
    kind: oneOf(b.kind, `${path}.kind`, BLOCKER_KINDS),
    title: text(b.title, `${path}.title`),
    detail: text(b.detail, `${path}.detail`, true),
    requestedBy,
    since: timestamp(b.since, `${path}.since`),
  };
  if (b.delegationId !== undefined) {
    const id = text(b.delegationId, `${path}.delegationId`);
    if (!delegations.has(id)) fail(`${path}.delegationId verweist auf unbekannte Delegation „${id}“.`);
    blocker.delegationId = id;
  }
  if (b.options !== undefined) blocker.options = list(b.options, `${path}.options`).map((o, j) => text(o, `${path}.options[${j}]`));
  const suggested = optionalText(b.suggestedInput, `${path}.suggestedInput`);
  if (suggested !== undefined) blocker.suggestedInput = suggested;
  return blocker;
}

export function parseSnapshot(raw: unknown): { state: CockpitState; info: DataInfo } {
  const s = obj(raw, 'Snapshot');
  if (s.kind !== 'atlas-snapshot') fail('Kein Atlas-Snapshot (kind).');
  if (s.version !== 1) fail(`Snapshot-Version ${String(s.version)} wird nicht unterstützt.`);
  const takenAt = timestamp(s.takenAt, 'takenAt');

  const workspaces = parseWorkspaces(s.workspaces);
  const projectIds = unique(workspaces.flatMap((w) => w.projects.map((p) => p.slug)), 'workspaces.projects');
  const recipients = parseRecipients(s.recipients);
  const recipientIds = unique(recipients.map((r) => r.id), 'recipients');
  const delegations = list(s.delegations, 'delegations').map((d, i) => parseDelegationRecord(d, i, recipientIds, projectIds));
  const delegationIds = unique(delegations.map((d) => d.id), 'delegations');
  const blockers = list(s.blockers, 'blockers').map((b, i) => parseBlocker(b, i, recipientIds, delegationIds));
  unique(blockers.map((b) => b.id), 'blockers');

  let staleDays = 3;
  if (s.settings !== undefined) {
    const value = obj(s.settings, 'settings').staleDays;
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 14) fail('settings.staleDays muss 1 bis 14 sein.');
    staleDays = value as number;
  }

  return { state: { workspaces, recipients, delegations, blockers, settings: { staleDays } }, info: { kind: 'snapshot', takenAt } };
}

/** Embedded snapshot when present, demo data otherwise. A broken snapshot throws instead of falling back. */
export function loadInitialState(now: Date, doc: Document): { state: CockpitState; info: DataInfo } {
  const element = doc.getElementById(SNAPSHOT_ELEMENT_ID);
  if (!element) return { state: createDemoState(now), info: { kind: 'demo' } };
  let raw: unknown;
  try {
    raw = JSON.parse(element.textContent ?? '');
  } catch (error) {
    throw new Error(`Der eingebettete Atlas-Snapshot ist kein gültiges JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return parseSnapshot(raw);
}

/**
 * Example sentences for the command bar built from the snapshot's own
 * recipients. Only sentences the parser accepts are offered.
 */
export function snapshotExamples(recipients: Recipient[], now: Date): string[] {
  const candidates = [
    ...recipients.filter((r) => r.kind === 'person').map((r) => `Gib das Review an ${r.name.split(' ')[0]} bis Freitag`),
    ...recipients.filter((r) => r.kind === 'agent').map((r) => `${r.name} soll die Zusammenfassung bis nächste Woche erstellen`),
  ];
  const valid = candidates.filter((sentence) => parseDelegation(sentence, recipients, now).ok);
  const person = valid.find((x) => x.startsWith('Gib'));
  const agent = valid.find((x) => !x.startsWith('Gib'));
  return [person, agent].filter((x): x is string => x !== undefined);
}
