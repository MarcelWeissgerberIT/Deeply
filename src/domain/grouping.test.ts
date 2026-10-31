import { describe, expect, it } from 'vitest';
import { assess, compareByUrgency } from './ampel';
import { groupByWorkspace, projectLabel, suggestProject } from './grouping';
import { NOW, SETTINGS, WORKSPACES, delegation, hoursAgo } from './testFixtures';

const rows = [
  delegation({ id: 'a', project: 'geraet' }),
  delegation({ id: 'b', project: 'handbuch', due: '2026-10-20' }),
  delegation({ id: 'c', project: 'release', lastSignalAt: hoursAgo(24 * 5) }),
  delegation({ id: 'd', project: 'geraet', status: 'done', doneAt: hoursAgo(5) }),
]
  .map((d) => ({ delegation: d, assessment: assess(d, NOW, SETTINGS) }))
  .sort(compareByUrgency);

describe('groupByWorkspace', () => {
  const groups = groupByWorkspace(rows, WORKSPACES);

  it('orders tenants by red, then yellow', () => {
    expect(groups.map((g) => g.workspace.slug)).toEqual(['intern', 'kunde-a']);
  });

  it('orders projects inside a tenant the same way and keeps row order', () => {
    const kundeA = groups[1]!;
    expect(kundeA.projects.map((p) => [p.project.slug, p.rows.map((r) => r.delegation.id)])).toEqual([
      ['release', ['c']],
      ['geraet', ['a', 'd']],
    ]);
  });

  it('counts lights per tenant and per project', () => {
    expect(groups[1]!.counts).toEqual({ red: 0, yellow: 1, green: 1, done: 1 });
    expect(groups[0]!.projects[0]!.counts).toEqual({ red: 1, yellow: 0, green: 0, done: 0 });
  });

  it('leaves out tenants and projects without delegations', () => {
    expect(groupByWorkspace(rows.filter((r) => r.delegation.id === 'b'), WORKSPACES).map((g) => g.workspace.slug)).toEqual([
      'intern',
    ]);
  });

  it('fails loudly on a project that belongs to no tenant', () => {
    const stray = [{ delegation: delegation({ project: 'unbekannt' }), assessment: { light: 'green' as const, reason: '' } }];
    expect(() => groupByWorkspace(stray, WORKSPACES)).toThrow('Projekt „unbekannt“ gehört zu keinem Tenant.');
  });
});

describe('projectLabel', () => {
  it('names tenant and project', () => {
    expect(projectLabel('release', WORKSPACES)).toBe('Kunde A › Release');
  });
});

describe('suggestProject', () => {
  it('picks the project the recipient works on most', () => {
    const items = [
      delegation({ id: '1', recipientId: 'lena', project: 'release' }),
      delegation({ id: '2', recipientId: 'lena', project: 'handbuch' }),
      delegation({ id: '3', recipientId: 'lena', project: 'handbuch' }),
      delegation({ id: '4', recipientId: 'jonas', project: 'geraet' }),
    ];
    expect(suggestProject(items, 'lena', WORKSPACES)).toBe('handbuch');
  });

  it('falls back to the first project for someone without delegations', () => {
    expect(suggestProject([], 'lena', WORKSPACES)).toBe('geraet');
  });
});
