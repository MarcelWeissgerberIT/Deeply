/** Shared fixtures for domain tests. Not used by the app. */
import type { Delegation, Recipient, Settings, Workspace } from './types';

/** Saturday, 31 Oct 2026, 10:00 local time. */
export const NOW = new Date(2026, 9, 31, 10, 0, 0);

export const SETTINGS: Settings = { staleDays: 3 };

export const RECIPIENTS: Recipient[] = [
  { id: 'lena', name: 'Lena Hoffmann', kind: 'person', role: 'QA-Leitung' },
  { id: 'jonas', name: 'Jonas Becker', kind: 'person', role: 'Entwicklung' },
  { id: 'review-agent', name: 'Review-Agent', kind: 'agent', role: 'Code-Reviews', owner: 'me' },
];

export const WORKSPACES: Workspace[] = [
  {
    slug: 'kunde-a',
    title: 'Kunde A',
    projects: [
      { slug: 'geraet', title: 'Gerät' },
      { slug: 'release', title: 'Release' },
    ],
  },
  { slug: 'intern', title: 'Intern', projects: [{ slug: 'handbuch', title: 'Handbuch' }] },
];

export function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

export function delegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'd1',
    title: 'Testfälle schreiben',
    recipientId: 'lena',
    project: 'geraet',
    source: 'atlas',
    sourceRef: 'DEMO-1',
    createdAt: hoursAgo(24 * 10),
    due: '2026-11-06',
    status: 'in-progress',
    lastSignalAt: hoursAgo(5),
    events: [],
    ...overrides,
  };
}
