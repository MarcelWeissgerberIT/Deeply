import { describe, expect, it } from 'vitest';
import { parseDeadline } from './parseDeadline';
import { NOW } from './testFixtures';

// NOW is Saturday, 31 Oct 2026.
const WEDNESDAY = new Date(2026, 10, 4, 9, 0);

describe('parseDeadline', () => {
  it.each([
    ['heute', '2026-10-31'],
    ['morgen', '2026-11-01'],
    ['übermorgen', '2026-11-02'],
    ['Freitag', '2026-11-06'],
    ['fr', '2026-11-06'],
    ['nächsten Freitag', '2026-11-06'],
    ['Montag', '2026-11-02'],
    ['Samstag', '2026-11-07'],
    ['Ende der Woche', '2026-11-06'],
    ['in 3 Tagen', '2026-11-03'],
    ['in einer Woche', '2026-11-07'],
    ['in 2 Wochen', '2026-11-14'],
    ['14.11.', '2026-11-14'],
    ['14.11.2026', '2026-11-14'],
    ['3.1.', '2027-01-03'],
    ['KW 46', '2026-11-13'],
    ['kw46', '2026-11-13'],
    ['Monatsende', '2026-10-31'],
    ['2026-11-20', '2026-11-20'],
  ])('reads „%s“ as %s', (text, expected) => {
    expect(parseDeadline(text, NOW)).toBe(expected);
  });

  it('distinguishes this week from next week mid-week', () => {
    expect(parseDeadline('Ende der Woche', WEDNESDAY)).toBe('2026-11-06');
    expect(parseDeadline('nächste Woche', WEDNESDAY)).toBe('2026-11-13');
  });

  it.each(['irgendwann', '31.02.', 'KW 60', ''])('rejects „%s“', (text) => {
    expect(parseDeadline(text, NOW)).toBeNull();
  });
});
