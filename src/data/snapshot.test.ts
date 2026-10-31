import { describe, expect, it } from 'vitest';
import { parseSnapshot, snapshotExamples } from './snapshot';

function valid(): Record<string, unknown> {
  return {
    kind: 'atlas-snapshot',
    version: 1,
    takenAt: '2026-10-31T09:40:00.000Z',
    workspaces: [{ slug: 't1', title: 't1', projects: [{ slug: 'p1', title: 'Projekt 1' }] }],
    recipients: [
      { id: 'kai', name: 'Kai Beispiel', kind: 'person', role: '' },
      { id: 'dev', name: 'Developer', kind: 'agent', role: 'Setzt Specs um', owner: 'mich' },
    ],
    delegations: [
      {
        id: 'r1',
        title: 'Ticket',
        recipientId: 'kai',
        project: 'p1',
        source: 'atlas',
        sourceRef: '/r/1',
        sourceStatus: 'Ready for Development',
        due: null,
        status: 'open',
        lastSignalAt: '2026-10-13T08:44:02.912Z',
        events: [{ at: '2026-10-13T08:44:02.912Z', kind: 'update', actor: 'system', text: 'Zuletzt in Atlas geändert' }],
      },
    ],
    blockers: [],
  };
}

describe('parseSnapshot', () => {
  it('accepts a well-formed Atlas snapshot', () => {
    const { state, info } = parseSnapshot(valid());
    expect(info).toEqual({ kind: 'snapshot', takenAt: '2026-10-31T09:40:00.000Z' });
    expect(state.delegations[0]).toMatchObject({ id: 'r1', due: null, project: 'p1', sourceStatus: 'Ready for Development' });
    expect(state.settings).toEqual({ staleDays: 3 });
  });

  it.each([
    [(s: Record<string, unknown>) => ({ ...s, kind: 'other' }), 'Kein Atlas-Snapshot (kind).'],
    [(s: Record<string, unknown>) => ({ ...s, version: 2 }), 'Snapshot-Version 2 wird nicht unterstützt.'],
    [(s: Record<string, unknown>) => ({ ...s, delegations: 'x' }), 'delegations muss eine Liste sein.'],
    [
      (s: Record<string, unknown>) => ({ ...s, delegations: [{ ...(s.delegations as object[])[0], status: 'kaputt' }] }),
      'delegations[0].status hat einen unbekannten Wert: kaputt',
    ],
    [
      (s: Record<string, unknown>) => ({ ...s, delegations: [{ ...(s.delegations as object[])[0], recipientId: 'niemand' }] }),
      'delegations[0].recipientId verweist auf unbekannten Empfänger „niemand“.',
    ],
    [
      (s: Record<string, unknown>) => ({ ...s, delegations: [{ ...(s.delegations as object[])[0], project: 'p9' }] }),
      'delegations[0].project verweist auf unbekanntes Projekt „p9“.',
    ],
    [
      (s: Record<string, unknown>) => ({ ...s, delegations: [{ ...(s.delegations as object[])[0], due: '31.10.2026' }] }),
      'delegations[0].due muss YYYY-MM-DD oder null sein.',
    ],
    [
      (s: Record<string, unknown>) => ({ ...s, delegations: [{ ...(s.delegations as object[])[0], lastSignalAt: 'gestern' }] }),
      'delegations[0].lastSignalAt muss ein ISO-Zeitstempel sein.',
    ],
  ])('rejects malformed data with a precise message (%#)', (mutate, message) => {
    expect(() => parseSnapshot(mutate(valid()))).toThrow(message);
  });

  it('rejects overlong text', () => {
    const s = valid();
    (s.delegations as Record<string, unknown>[])[0]!.title = 'x'.repeat(501);
    expect(() => parseSnapshot(s)).toThrow('delegations[0].title ist zu lang (höchstens 500 Zeichen).');
  });
});

describe('snapshotExamples', () => {
  it('builds one person and one agent example that the parser understands, skipping ambiguous names', () => {
    const recipients = [
      { id: 'kai1', name: 'Kai Muster', kind: 'person' as const, role: '' },
      { id: 'kai2', name: 'Kai', kind: 'person' as const, role: '' },
      { id: 'ragna', name: 'Ragna Probst', kind: 'person' as const, role: '' },
      { id: 'dev', name: 'Developer', kind: 'agent' as const, role: '' },
    ];
    expect(snapshotExamples(recipients, new Date(2026, 9, 31, 10))).toEqual([
      'Gib das Review an Ragna bis Freitag',
      'Developer soll die Zusammenfassung bis nächste Woche erstellen',
    ]);
  });
});
