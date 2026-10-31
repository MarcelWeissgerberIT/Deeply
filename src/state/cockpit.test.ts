import { describe, expect, it } from 'vitest';
import { cockpitReducer, type CockpitState } from './cockpit';
import type { Blocker } from '../domain/types';
import { NOW, RECIPIENTS, delegation, hoursAgo } from '../domain/testFixtures';

const nowIso = NOW.toISOString();

function state(overrides: Partial<CockpitState> = {}): CockpitState {
  return {
    recipients: RECIPIENTS,
    delegations: [delegation()],
    blockers: [],
    settings: { staleDays: 3 },
    ...overrides,
  };
}

const approval: Blocker = {
  id: 'b1',
  kind: 'approval',
  title: 'Schreibzugriff auf Polarion',
  detail: '38 Items',
  requestedBy: 'review-agent',
  since: hoursAgo(20),
  delegationId: 'agent-job',
};

describe('cockpitReducer', () => {
  it('creates a delegation from a parsed sentence and links it to Atlas', () => {
    const next = cockpitReducer(state({ delegations: [] }), {
      type: 'delegate',
      id: 'new-1',
      draft: { title: 'FMEA', recipientId: 'lena', due: '2026-11-06', context: 'Audit' },
      now: nowIso,
    });
    expect(next.delegations).toHaveLength(1);
    const created = next.delegations[0]!;
    expect(created).toMatchObject({
      id: 'new-1',
      title: 'FMEA',
      recipientId: 'lena',
      source: 'atlas',
      due: '2026-11-06',
      context: 'Audit',
      status: 'open',
      createdAt: nowIso,
      lastSignalAt: nowIso,
    });
    expect(created.events).toEqual([{ at: nowIso, kind: 'created', actor: 'me', text: 'Delegiert per Satz, in Atlas angelegt' }]);
  });

  it('records a sent follow-up without counting it as a sign of life', () => {
    const before = state();
    const next = cockpitReducer(before, { type: 'followUpSent', delegationId: 'd1', message: 'Wie ist der Stand?', now: nowIso });
    const d = next.delegations[0]!;
    expect(d.followUp).toEqual({ state: 'sent', sentAt: nowIso });
    expect(d.lastSignalAt).toBe(before.delegations[0]!.lastSignalAt);
    expect(d.events.at(-1)).toEqual({ at: nowIso, kind: 'follow-up', actor: 'me', text: 'Wie ist der Stand?' });
  });

  it('turns a reply into an update', () => {
    const sent = cockpitReducer(state(), { type: 'followUpSent', delegationId: 'd1', message: 'Stand?', now: hoursAgo(1) });
    const next = cockpitReducer(sent, { type: 'replyReceived', delegationId: 'd1', text: 'Bin bei 80 %.', now: nowIso });
    const d = next.delegations[0]!;
    expect(d.followUp).toEqual({ state: 'answered', sentAt: hoursAgo(1) });
    expect(d.lastSignalAt).toBe(nowIso);
    expect(d.events.at(-1)).toEqual({ at: nowIso, kind: 'reply', actor: 'lena', text: 'Bin bei 80 %.' });
  });

  it('escalates an unanswered follow-up', () => {
    const sent = cockpitReducer(state(), { type: 'followUpSent', delegationId: 'd1', message: 'Stand?', now: hoursAgo(30) });
    const next = cockpitReducer(sent, { type: 'escalate', delegationId: 'd1', now: nowIso });
    expect(next.delegations[0]!.followUp).toEqual({ state: 'escalated', sentAt: hoursAgo(30) });
    expect(next.delegations[0]!.events.at(-1)).toMatchObject({ kind: 'escalation', actor: 'me' });
  });

  it('approves a critical agent step and lets the agent continue', () => {
    const job = delegation({ id: 'agent-job', recipientId: 'review-agent', status: 'waiting-approval' });
    const next = cockpitReducer(state({ delegations: [job], blockers: [approval] }), {
      type: 'resolveBlocker',
      blockerId: 'b1',
      resolution: { kind: 'approve' },
      now: nowIso,
    });
    expect(next.blockers).toEqual([]);
    expect(next.delegations[0]).toMatchObject({ status: 'in-progress', lastSignalAt: nowIso });
    expect(next.delegations[0]!.events.at(-1)).toEqual({
      at: nowIso,
      kind: 'approved',
      actor: 'me',
      text: 'Freigegeben: Schreibzugriff auf Polarion',
    });
  });

  it('rejects a critical agent step', () => {
    const job = delegation({ id: 'agent-job', recipientId: 'review-agent', status: 'waiting-approval' });
    const next = cockpitReducer(state({ delegations: [job], blockers: [approval] }), {
      type: 'resolveBlocker',
      blockerId: 'b1',
      resolution: { kind: 'reject' },
      now: nowIso,
    });
    expect(next.delegations[0]).toMatchObject({ status: 'open' });
    expect(next.delegations[0]!.events.at(-1)).toMatchObject({ kind: 'rejected', text: 'Abgelehnt: Schreibzugriff auf Polarion' });
  });

  it('unblocks a delegation with a decision', () => {
    const blocked = delegation({ status: 'blocked', blockedReason: 'Lizenz fehlt' });
    const decision: Blocker = {
      id: 'b2',
      kind: 'decision',
      title: 'Lizenz oder Alternative?',
      detail: '',
      requestedBy: 'lena',
      since: hoursAgo(10),
      delegationId: 'd1',
      options: ['Lizenz kaufen', 'Alternative prüfen'],
    };
    const next = cockpitReducer(state({ delegations: [blocked], blockers: [decision] }), {
      type: 'resolveBlocker',
      blockerId: 'b2',
      resolution: { kind: 'decide', option: 'Lizenz kaufen' },
      now: nowIso,
    });
    expect(next.delegations[0]!.status).toBe('in-progress');
    expect(next.delegations[0]!.blockedReason).toBeUndefined();
    expect(next.delegations[0]!.events.at(-1)).toMatchObject({ kind: 'decision', text: 'Entschieden: Lizenz kaufen' });
  });

  it('refuses decisions that are not among the options', () => {
    const decision: Blocker = { id: 'b2', kind: 'decision', title: 'X?', detail: '', requestedBy: 'lena', since: nowIso, options: ['A'] };
    expect(() =>
      cockpitReducer(state({ blockers: [decision] }), {
        type: 'resolveBlocker',
        blockerId: 'b2',
        resolution: { kind: 'decide', option: 'B' },
        now: nowIso,
      }),
    ).toThrow('Option „B“ gehört nicht zu dieser Entscheidung.');
  });

  it('refuses empty input', () => {
    const input: Blocker = { id: 'b3', kind: 'input', title: 'Termine', detail: '', requestedBy: 'lena', since: nowIso };
    expect(() =>
      cockpitReducer(state({ blockers: [input] }), {
        type: 'resolveBlocker',
        blockerId: 'b3',
        resolution: { kind: 'input', text: '   ' },
        now: nowIso,
      }),
    ).toThrow('Der Input ist leer.');
  });

  it('refuses resolutions that do not fit the blocker kind', () => {
    expect(() =>
      cockpitReducer(state({ blockers: [{ ...approval, delegationId: undefined }] }), {
        type: 'resolveBlocker',
        blockerId: 'b1',
        resolution: { kind: 'input', text: 'x' },
        now: nowIso,
      }),
    ).toThrow('Diese Aktion passt nicht zu einer Freigabe.');
  });

  it('fails loudly on unknown ids', () => {
    expect(() => cockpitReducer(state(), { type: 'escalate', delegationId: 'nope', now: nowIso })).toThrow(
      'Delegation „nope“ nicht gefunden.',
    );
    expect(() =>
      cockpitReducer(state(), { type: 'resolveBlocker', blockerId: 'nope', resolution: { kind: 'approve' }, now: nowIso }),
    ).toThrow('Blocker „nope“ nicht gefunden.');
  });

  it('accepts a yellow threshold between 1 and 14 days', () => {
    expect(cockpitReducer(state(), { type: 'setStaleDays', days: 5 }).settings.staleDays).toBe(5);
    expect(() => cockpitReducer(state(), { type: 'setStaleDays', days: 0 })).toThrow();
    expect(() => cockpitReducer(state(), { type: 'setStaleDays', days: 2.5 })).toThrow();
  });
});
