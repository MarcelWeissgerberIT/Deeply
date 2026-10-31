import { describe, expect, it } from 'vitest';
import { parseDelegation } from './parseDelegation';
import { NOW, RECIPIENTS } from './testFixtures';

const parse = (s: string) => parseDelegation(s, RECIPIENTS, NOW);

describe('parseDelegation (Delegieren per Satz)', () => {
  it('reads „Gib X an Y bis Freitag“', () => {
    expect(parse('Gib die Risikoanalyse an Lena bis Freitag')).toEqual({
      ok: true,
      draft: { title: 'Risikoanalyse', recipientId: 'lena', due: '2026-11-06' },
    });
  });

  it('accepts full names and other verbs', () => {
    expect(parse('Delegiere Pen-Test-Nachverfolgung an Jonas Becker bis 14.11.')).toEqual({
      ok: true,
      draft: { title: 'Pen-Test-Nachverfolgung', recipientId: 'jonas', due: '2026-11-14' },
    });
  });

  it('delegates to agents like to people', () => {
    expect(parse('Gib das Code-Review für das Login-Modul an den Review-Agent bis morgen')).toEqual({
      ok: true,
      draft: { title: 'Code-Review für das Login-Modul', recipientId: 'review-agent', due: '2026-11-01' },
    });
  });

  it('uses the last „an“ as the recipient marker', () => {
    expect(parse('Gib das Feedback an den Kunden an Lena bis Freitag')).toEqual({
      ok: true,
      draft: { title: 'Feedback an den Kunden', recipientId: 'lena', due: '2026-11-06' },
    });
  });

  it('reads „Y soll X bis Z erledigen“', () => {
    expect(parse('Lena soll die Auditcheckliste bis KW 46 fertigstellen')).toEqual({
      ok: true,
      draft: { title: 'Auditcheckliste', recipientId: 'lena', due: '2026-11-13' },
    });
  });

  it('takes context after a dash', () => {
    expect(parse('Gib die FMEA an Lena bis Freitag – Kunde fragt nach dem Stand')).toEqual({
      ok: true,
      draft: { title: 'FMEA', recipientId: 'lena', due: '2026-11-06', context: 'Kunde fragt nach dem Stand' },
    });
  });

  it('takes context after „, Kontext:“', () => {
    expect(parse('Gib die FMEA an Lena bis Freitag, Kontext: Audit am 20.11.')).toEqual({
      ok: true,
      draft: { title: 'FMEA', recipientId: 'lena', due: '2026-11-06', context: 'Audit am 20.11.' },
    });
  });

  it.each([
    ['', 'Beschreibe die Aufgabe in einem Satz, z. B. „Gib X an Y bis Freitag“.'],
    ['Mach mal was', 'Ich erkenne Aufgabe und Empfänger nicht. Schreib z. B. „Gib X an Y bis Freitag“.'],
    ['Gib die FMEA an Lena', 'Bis wann? Ergänze eine Frist, z. B. „bis Freitag“.'],
    ['Gib die FMEA an Petra bis Freitag', 'Ich kenne „Petra“ nicht. Möglich sind: Lena Hoffmann, Jonas Becker, Review-Agent.'],
    [
      'Gib die FMEA an Lena bis irgendwann',
      '„irgendwann“ verstehe ich nicht als Frist. Beispiele: Freitag, morgen, 14.11., in 3 Tagen, KW 46.',
    ],
    ['Gib die FMEA an Lena bis 01.10.2026', 'Die Frist 01.10.2026 liegt in der Vergangenheit.'],
    [`Gib ${'x'.repeat(300)} an Lena bis Freitag`, 'Der Satz ist zu lang (höchstens 300 Zeichen).'],
  ])('explains what is missing in „%s“', (sentence, error) => {
    expect(parse(sentence)).toEqual({ ok: false, error });
  });

  it('refuses ambiguous recipients', () => {
    const recipients = [...RECIPIENTS, { id: 'lena2', name: 'Lena Schulz', kind: 'person' as const, role: 'Einkauf' }];
    expect(parseDelegation('Gib die FMEA an Lena bis Freitag', recipients, NOW)).toEqual({
      ok: false,
      error: '„Lena“ ist nicht eindeutig: Lena Hoffmann, Lena Schulz.',
    });
  });
});
