import { describe, expect, it } from 'vitest';
import { composeRequest, planFollowUps } from './followUp';
import { NOW, RECIPIENTS, SETTINGS, delegation, hoursAgo } from './testFixtures';

const lena = RECIPIENTS[0]!;
const agent = RECIPIENTS[2]!;

describe('planFollowUps', () => {
  it('leaves fresh delegations alone', () => {
    expect(planFollowUps([delegation()], NOW, SETTINGS)).toEqual([]);
  });

  it('asks one day before an item would turn yellow', () => {
    const plans = planFollowUps([delegation({ lastSignalAt: hoursAgo(24 * 2 + 2) })], NOW, SETTINGS);
    expect(plans).toEqual([{ delegationId: 'd1', action: 'ask', reason: 'kippt morgen auf Gelb' }]);
  });

  it('asks when an item is already yellow', () => {
    const plans = planFollowUps([delegation({ lastSignalAt: hoursAgo(24 * 5) })], NOW, SETTINGS);
    expect(plans).toEqual([{ delegationId: 'd1', action: 'ask', reason: 'seit 5 Tagen ohne Update' }]);
  });

  it('asks shortly before the deadline when the last update is a day old', () => {
    const d = delegation({ due: '2026-11-02', lastSignalAt: hoursAgo(26) });
    expect(planFollowUps([d], NOW, SETTINGS)).toEqual([
      { delegationId: 'd1', action: 'ask', reason: 'fällig in 2 T, letztes Update vor 1 T' },
    ]);
  });

  it('asks about overdue items that have not been asked yet', () => {
    const d = delegation({ due: '2026-10-30', lastSignalAt: hoursAgo(10) });
    expect(planFollowUps([d], NOW, SETTINGS)).toEqual([{ delegationId: 'd1', action: 'ask', reason: 'überfällig seit 1 Tag' }]);
  });

  it('waits a day for an answer after asking', () => {
    const d = delegation({ lastSignalAt: hoursAgo(24 * 5), followUp: { state: 'sent', sentAt: hoursAgo(5) } });
    expect(planFollowUps([d], NOW, SETTINGS)).toEqual([]);
  });

  it('proposes escalation when the request stays unanswered for a day', () => {
    const d = delegation({ lastSignalAt: hoursAgo(24 * 5), followUp: { state: 'sent', sentAt: hoursAgo(30) } });
    expect(planFollowUps([d], NOW, SETTINGS)).toEqual([
      { delegationId: 'd1', action: 'escalate', reason: 'keine Antwort seit 1 T' },
    ]);
  });

  it('does not chase done, blocked, escalated or approval-waiting items', () => {
    const old = hoursAgo(24 * 6);
    const items = [
      delegation({ id: 'a', status: 'done', lastSignalAt: old }),
      delegation({ id: 'b', status: 'blocked', lastSignalAt: old }),
      delegation({ id: 'c', status: 'waiting-approval', lastSignalAt: old }),
      delegation({ id: 'e', lastSignalAt: old, followUp: { state: 'escalated', sentAt: old } }),
    ];
    expect(planFollowUps(items, NOW, SETTINGS)).toEqual([]);
  });

  it('starts counting silence again after an answer', () => {
    const d = delegation({ lastSignalAt: hoursAgo(3), followUp: { state: 'answered', sentAt: hoursAgo(30) } });
    expect(planFollowUps([d], NOW, SETTINGS)).toEqual([]);
  });

  it('lists escalations first, then the nearest deadline', () => {
    const items = [
      delegation({ id: 'later', due: '2026-11-10', lastSignalAt: hoursAgo(24 * 4) }),
      delegation({ id: 'sooner', due: '2026-11-03', lastSignalAt: hoursAgo(24 * 4) }),
      delegation({ id: 'esc', due: '2026-11-20', lastSignalAt: hoursAgo(24 * 4), followUp: { state: 'sent', sentAt: hoursAgo(48) } }),
    ];
    expect(planFollowUps(items, NOW, SETTINGS).map((p) => p.delegationId)).toEqual(['esc', 'sooner', 'later']);
  });
});

describe('composeRequest', () => {
  it('writes a friendly question to people, addressed by first name', () => {
    const text = composeRequest(delegation(), lena);
    expect(text).toBe(
      'Hallo Lena, kurze Nachfrage zu „Testfälle schreiben“ (fällig Fr 06.11.): Wie ist der Stand, und brauchst du etwas von mir? Ein Satz als Antwort reicht, er landet direkt als Update im Cockpit. Danke!',
    );
  });

  it('asks agents for progress, next step and pending approvals', () => {
    const text = composeRequest(delegation({ recipientId: 'review-agent' }), agent);
    expect(text).toBe(
      'Statusabfrage an Review-Agent: Bitte Fortschritt, nächsten Schritt und offene Freigaben zu „Testfälle schreiben“ melden (fällig Fr 06.11.).',
    );
  });
});
