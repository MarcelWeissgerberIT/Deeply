import { describe, expect, it } from 'vitest';
import { assess } from '../domain/ampel';
import { planFollowUps } from '../domain/followUp';
import { NOW } from '../domain/testFixtures';
import { parseDelegation } from '../domain/parseDelegation';
import { DEMO_EXAMPLES, createDemoState } from './demo';

describe('demo data', () => {
  const state = createDemoState(NOW);
  const recipientIds = new Set(state.recipients.map((r) => r.id));
  const delegationIds = new Set(state.delegations.map((d) => d.id));

  it('references only known recipients and delegations', () => {
    expect(delegationIds.size).toBe(state.delegations.length);
    for (const d of state.delegations) {
      expect(recipientIds.has(d.recipientId)).toBe(true);
      for (const e of d.events) expect(e.actor === 'me' || recipientIds.has(e.actor)).toBe(true);
    }
    const projects = new Set(state.workspaces.flatMap((w) => w.projects.map((p) => p.slug)));
    for (const d of state.delegations) expect(projects.has(d.project)).toBe(true);
    for (const b of state.blockers) {
      expect(recipientIds.has(b.requestedBy)).toBe(true);
      if (b.delegationId) expect(delegationIds.has(b.delegationId)).toBe(true);
    }
  });

  it('marks every Atlas, Jira and Polarion ref as demo', () => {
    for (const d of state.delegations) {
      if (['atlas', 'jira', 'polarion'].includes(d.source)) expect(d.sourceRef).toMatch(/^DEMO-/);
    }
  });

  it('shows a realistic mix of exceptions', () => {
    const lights = state.delegations.map((d) => assess(d, NOW, state.settings).light);
    const count = (l: string) => lights.filter((x) => x === l).length;
    expect({ red: count('red'), yellow: count('yellow'), green: count('green'), done: count('done') }).toEqual({
      red: 3,
      yellow: 4,
      green: 7,
      done: 3,
    });
  });

  it('has one escalation and three status requests queued', () => {
    const plans = planFollowUps(state.delegations, NOW, state.settings);
    expect(plans.map((p) => [p.delegationId, p.action])).toEqual([
      ['d1', 'escalate'],
      ['d12', 'ask'],
      ['d5', 'ask'],
      ['d4', 'ask'],
    ]);
  });

  it.each(DEMO_EXAMPLES)('understands the example sentence „%s“', (sentence) => {
    expect(parseDelegation(sentence, state.recipients, NOW).ok).toBe(true);
  });
});
