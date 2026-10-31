import { describe, expect, it } from 'vitest';
import { buildDigest, digestToText } from './digest';
import type { Blocker } from './types';
import { NOW, RECIPIENTS, SETTINGS, delegation, hoursAgo } from './testFixtures';

const items = [
  delegation({ id: 'done-recent', title: 'Schulung GMP', status: 'done', doneAt: hoursAgo(48) }),
  delegation({ id: 'done-old', title: 'Altes Thema', status: 'done', doneAt: hoursAgo(24 * 10) }),
  delegation({ id: 'yellow', title: 'Auditvorbereitung', lastSignalAt: hoursAgo(24 * 5), due: '2026-11-05' }),
  delegation({ id: 'red', title: 'FMEA', recipientId: 'jonas', due: '2026-10-29' }),
  delegation({ id: 'green', title: 'Release-Notes' }),
];

const blockers: Blocker[] = [
  { id: 'b2', kind: 'input', title: 'Termine fürs Audit', detail: '', requestedBy: 'lena', since: hoursAgo(5) },
  { id: 'b1', kind: 'approval', title: 'Merge freigeben', detail: '', requestedBy: 'review-agent', since: hoursAgo(30) },
];

describe('buildDigest', () => {
  const digest = buildDigest(items, blockers, NOW, SETTINGS);

  it('labels the calendar week and the last seven days', () => {
    expect(digest.weekLabel).toBe('KW 44');
    expect(digest.periodLabel).toBe('25.10.–31.10.');
  });

  it('lists work completed in the last seven days', () => {
    expect(digest.done.map((d) => d.id)).toEqual(['done-recent']);
  });

  it('lists endangered work, red before yellow', () => {
    expect(digest.atRisk.map((r) => [r.delegation.id, r.assessment.light])).toEqual([
      ['red', 'red'],
      ['yellow', 'yellow'],
    ]);
  });

  it('lists what waits on me, longest waiting first', () => {
    expect(digest.needsMe.map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('renders a plain-text summary for mail or chat', () => {
    expect(digestToText(digest, RECIPIENTS)).toBe(
      [
        'Wochen-Digest KW 44 (25.10.–31.10.)',
        '1 erledigt · 1 kritisch · 1 gefährdet · 2 brauchen mich',
        '',
        'Erledigt',
        '- Schulung GMP (Lena Hoffmann)',
        '',
        'Gefährdet',
        '- [Rot] FMEA (Jonas Becker): überfällig seit 2 Tagen',
        '- [Gelb] Auditvorbereitung (Lena Hoffmann): seit 5 Tagen ohne Update',
        '',
        'Braucht mich',
        '- Freigabe: Merge freigeben (Review-Agent, wartet seit 1 T)',
        '- Input: Termine fürs Audit (Lena Hoffmann, wartet seit 5 Std.)',
      ].join('\n'),
    );
  });
});
