import { describe, expect, it } from 'vitest';
import { assess, isException } from './ampel';
import { NOW, SETTINGS, delegation, hoursAgo } from './testFixtures';

describe('assess (Ampel)', () => {
  it('is green while updates are fresh and the deadline is ahead', () => {
    expect(assess(delegation(), NOW, SETTINGS)).toEqual({ light: 'green', reason: 'läuft' });
  });

  it('mentions an imminent deadline on green items', () => {
    const a = assess(delegation({ due: '2026-11-01' }), NOW, SETTINGS);
    expect(a).toEqual({ light: 'green', reason: 'fällig morgen' });
  });

  it('turns yellow after X days without an update', () => {
    const a = assess(delegation({ lastSignalAt: hoursAgo(24 * 4 + 1) }), NOW, SETTINGS);
    expect(a).toEqual({ light: 'yellow', reason: 'seit 4 Tagen ohne Update' });
  });

  it('respects the configured threshold', () => {
    const d = delegation({ lastSignalAt: hoursAgo(24 * 4 + 1) });
    expect(assess(d, NOW, { staleDays: 5 }).light).toBe('green');
  });

  it('turns red when overdue', () => {
    const a = assess(delegation({ due: '2026-10-29' }), NOW, SETTINGS);
    expect(a).toEqual({ light: 'red', reason: 'überfällig seit 2 Tagen' });
  });

  it('uses the singular for one day overdue', () => {
    expect(assess(delegation({ due: '2026-10-30' }), NOW, SETTINGS).reason).toBe('überfällig seit 1 Tag');
  });

  it('is not overdue on the due day itself', () => {
    expect(assess(delegation({ due: '2026-10-31' }), NOW, SETTINGS)).toEqual({ light: 'green', reason: 'fällig heute' });
  });

  it('turns red when blocked and names the reason', () => {
    const a = assess(delegation({ status: 'blocked', blockedReason: 'Lizenz fehlt' }), NOW, SETTINGS);
    expect(a).toEqual({ light: 'red', reason: 'blockiert: Lizenz fehlt' });
  });

  it('turns red after an escalation', () => {
    const d = delegation({ followUp: { state: 'escalated', sentAt: hoursAgo(30) } });
    expect(assess(d, NOW, SETTINGS)).toEqual({ light: 'red', reason: 'eskaliert: keine Antwort auf Nachfrage' });
  });

  it('is yellow while an agent waits for my approval', () => {
    const a = assess(delegation({ status: 'waiting-approval' }), NOW, SETTINGS);
    expect(a).toEqual({ light: 'yellow', reason: 'wartet auf meine Freigabe' });
  });

  it('reports done items as done, even when the deadline has passed', () => {
    const a = assess(delegation({ status: 'done', due: '2026-10-20', doneAt: hoursAgo(48) }), NOW, SETTINGS);
    expect(a).toEqual({ light: 'done', reason: 'erledigt' });
  });

  it('isException is true only for red and yellow', () => {
    expect(isException({ light: 'red', reason: '' })).toBe(true);
    expect(isException({ light: 'yellow', reason: '' })).toBe(true);
    expect(isException({ light: 'green', reason: '' })).toBe(false);
    expect(isException({ light: 'done', reason: '' })).toBe(false);
  });
});
