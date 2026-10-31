/**
 * Demo data for the prototype. Everything here is invented and clearly marked
 * as demo in the UI; refs use the DEMO- prefix so they cannot be mistaken for
 * real Atlas records. All times are relative to "now", so the demo stays
 * current whenever it is opened.
 *
 * In production this module is replaced by a loader that reads Atlas
 * (records with assignee/due/updated, agent jobs, approvals) and the connected
 * tools. The shape it must return is CockpitState.
 */
import { addDays, formatDayMonth, isoWeek, startOfDay, toDateOnly } from '../domain/dates';
import type { Blocker, Delegation, Recipient, TimelineEvent, Workspace } from '../domain/types';
import type { CockpitState } from '../state/cockpit';

/** Invented tenants and projects; the real ones only appear in a private snapshot. */
export const DEMO_WORKSPACES: Workspace[] = [
  {
    slug: 'muster-analytik',
    title: 'Muster Analytik',
    projects: [
      { slug: 'probenwechsler', title: 'Probenwechsler' },
      { slug: 'release-4-2', title: 'Release 4.2' },
    ],
  },
  {
    slug: 'beispiel-pharma',
    title: 'Beispiel Pharma',
    projects: [
      { slug: 'lieferantenaudit', title: 'Lieferantenaudit' },
      { slug: 'lims-qualifizierung', title: 'LIMS-Qualifizierung' },
    ],
  },
  {
    slug: 'eigene-produkte',
    title: 'Eigene Produkte',
    projects: [
      { slug: 'dokumentation', title: 'Dokumentation' },
      { slug: 'pilotkunden', title: 'Pilotkunden' },
    ],
  },
];

export const DEMO_RECIPIENTS: Recipient[] = [
  { id: 'lena', name: 'Lena Hoffmann', kind: 'person', role: 'QA-Leitung' },
  { id: 'jonas', name: 'Jonas Becker', kind: 'person', role: 'Softwareentwicklung' },
  { id: 'aylin', name: 'Aylin Demir', kind: 'person', role: 'Produktmanagement' },
  { id: 'tobias', name: 'Tobias Krüger', kind: 'person', role: 'Regulatory Affairs' },
  { id: 'sophie', name: 'Sophie Wagner', kind: 'person', role: 'Test-Engineering' },
  { id: 'malte', name: 'Malte Brandt', kind: 'person', role: 'Technische Redaktion (extern)' },
  { id: 'review-agent', name: 'Review-Agent', kind: 'agent', role: 'Code-Reviews und Checkups', owner: 'mich' },
  { id: 'doku-agent', name: 'Doku-Agent', kind: 'agent', role: 'Release-Notes und Changelogs', owner: 'mich' },
  { id: 'trace-agent', name: 'Trace-Agent', kind: 'agent', role: 'Traceability gegen Polarion', owner: 'mich' },
  { id: 'recherche-agent', name: 'Recherche-Agent', kind: 'agent', role: 'Markt- und Wettbewerbsrecherche', owner: 'mich' },
];

/** Example sentences for the command bar, matching the demo team. */
export const DEMO_EXAMPLES = [
  'Gib die Lieferantenbewertung an Tobias bis Freitag',
  'Recherche-Agent soll Marktpreise für Pipetten bis KW 46 erstellen',
  'Gib das Protokoll der Produktrunde an Aylin bis morgen – Kunde wartet',
];

const DEMO_REPLIES: Record<string, string> = {
  d4: 'Checkliste steht. Die Termine fehlen noch, weil ich auf deine Verfügbarkeit warte.',
  d5: 'Kapitel 7 ist zur Hälfte überarbeitet, der Rest kommt bis Mittwoch.',
  d7: 'Interviews sind ausgewertet, die Zusammenfassung schreibe ich morgen.',
  d12: 'Drei von fünf Befunden sind behoben, die zwei offenen sind im Sprint eingeplant.',
};

/** The simulated answer to a status request (demo only). */
export function demoReply(delegationId: string, recipient: Recipient): string {
  const scripted = DEMO_REPLIES[delegationId];
  if (scripted) return scripted;
  return recipient.kind === 'agent'
    ? 'Job läuft planmäßig. Nächster Schritt ist eingeplant, keine offenen Freigaben.'
    : 'Läuft. Ich melde mich bis zur Frist mit dem Ergebnis.';
}

export function createDemoState(now: Date): CockpitState {
  const today = startOfDay(now);
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const dueIn = (days: number) => toDateOnly(addDays(today, days));
  const dayLabel = (daysAgo: number) => formatDayMonth(addDays(today, -daysAgo));
  const ev = (hoursAgo: number, kind: TimelineEvent['kind'], actor: string, text: string): TimelineEvent => ({
    at: ago(hoursAgo),
    kind,
    actor,
    text,
  });

  const delegations: Delegation[] = [
    {
      id: 'd1',
      title: 'FMEA für den Probenwechsler aktualisieren',
      recipientId: 'tobias',
      project: 'probenwechsler',
      source: 'polarion',
      sourceRef: 'DEMO-P-7781',
      context: 'Grundlage für das Design-Review Release 4.2',
      createdAt: ago(24 * 12),
      due: dueIn(-2),
      status: 'in-progress',
      lastSignalAt: ago(24 * 5),
      followUp: { state: 'sent', sentAt: ago(24 * 3 + 1) },
      events: [
        ev(24 * 12, 'created', 'me', 'Delegiert in der Regulatory-Runde'),
        ev(24 * 5, 'update', 'tobias', 'Entwurf zu 60 % fertig, die Bewertungen für den Greifer fehlen noch.'),
        ev(24 * 3 + 1, 'follow-up', 'me', 'Hallo Tobias, kurze Nachfrage zur FMEA: Wie ist der Stand, und brauchst du etwas von mir?'),
      ],
    },
    {
      id: 'd2',
      title: 'Testumgebung für Release 4.2 bereitstellen',
      recipientId: 'jonas',
      project: 'release-4-2',
      source: 'jira',
      sourceRef: 'DEMO-REL-231',
      createdAt: ago(24 * 6),
      due: dueIn(3),
      status: 'blocked',
      blockedReason: 'Lizenz der Testautomatisierung abgelaufen',
      lastSignalAt: ago(20),
      events: [
        ev(24 * 6, 'created', 'me', 'Delegiert aus Jira'),
        ev(20, 'update', 'jonas', 'Blockiert: Die Lizenz der Testautomatisierung ist abgelaufen. Ich brauche eine Entscheidung.'),
      ],
    },
    {
      id: 'd3',
      title: 'Changelog 4.1.3 aus den Atlas-Records erzeugen',
      recipientId: 'doku-agent',
      project: 'release-4-2',
      source: 'atlas',
      sourceRef: 'DEMO-1187',
      createdAt: ago(30),
      due: dueIn(1),
      status: 'blocked',
      blockedReason: 'Job abgebrochen, keine Leserechte auf das Release-Projekt',
      lastSignalAt: ago(6),
      events: [
        ev(30, 'created', 'me', 'Agent-Job gestartet'),
        ev(6, 'update', 'doku-agent', 'Job abgebrochen: keine Leserechte auf das Release-Projekt. Bitte Zugriff erteilen oder Projekt freigeben.'),
      ],
    },
    {
      id: 'd4',
      title: 'Lieferantenaudit vorbereiten: Checkliste und Termine',
      recipientId: 'lena',
      project: 'lieferantenaudit',
      source: 'mail',
      sourceRef: `vom ${dayLabel(9)}`,
      createdAt: ago(24 * 9),
      due: dueIn(6),
      status: 'in-progress',
      lastSignalAt: ago(24 * 4 + 2),
      events: [
        ev(24 * 9, 'created', 'me', 'Per Mail delegiert'),
        ev(24 * 4 + 2, 'update', 'lena', `Checkliste ist im Entwurf. Ich brauche zwei mögliche Termine in KW ${isoWeek(addDays(today, 14))}.`),
      ],
    },
    {
      id: 'd5',
      title: 'Benutzerhandbuch Kapitel 7 überarbeiten',
      recipientId: 'malte',
      project: 'dokumentation',
      source: 'mail',
      sourceRef: `vom ${dayLabel(8)}`,
      createdAt: ago(24 * 8),
      due: dueIn(4),
      status: 'in-progress',
      lastSignalAt: ago(24 * 2 + 3),
      events: [
        ev(24 * 8, 'created', 'me', 'Per Mail beauftragt'),
        ev(24 * 2 + 3, 'update', 'malte', 'Abschnitte 7.1 bis 7.3 sind fertig.'),
      ],
    },
    {
      id: 'd6',
      title: 'Traceability-Matrix Release 4.2 mit Polarion abgleichen',
      recipientId: 'trace-agent',
      project: 'release-4-2',
      source: 'atlas',
      sourceRef: 'DEMO-1203',
      createdAt: ago(28),
      due: dueIn(5),
      status: 'waiting-approval',
      lastSignalAt: ago(3),
      events: [
        ev(28, 'created', 'me', 'Agent-Job gestartet'),
        ev(3, 'update', 'trace-agent', 'Abgleich vorbereitet: 38 Items brauchen neue Trace-Links. Warte auf Freigabe zum Schreiben.'),
      ],
    },
    {
      id: 'd7',
      title: 'Feedback der Pilotkunden auswerten',
      recipientId: 'aylin',
      project: 'pilotkunden',
      source: 'meeting',
      sourceRef: `Produktrunde ${dayLabel(4)}`,
      context: 'Action Item aus der Produktrunde',
      createdAt: ago(24 * 4),
      due: dueIn(2),
      status: 'in-progress',
      lastSignalAt: ago(24 * 3 + 5),
      followUp: { state: 'sent', sentAt: ago(20) },
      events: [
        ev(24 * 4, 'created', 'me', 'Action Item aus der Produktrunde übernommen'),
        ev(24 * 3 + 5, 'update', 'aylin', 'Sechs von acht Interviews sind geführt.'),
        ev(20, 'follow-up', 'me', 'Hallo Aylin, kurze Nachfrage zum Pilotkunden-Feedback: Wie ist der Stand?'),
      ],
    },
    {
      id: 'd8',
      title: 'Code-Review Login-Modul',
      recipientId: 'review-agent',
      project: 'release-4-2',
      source: 'atlas',
      sourceRef: 'DEMO-1211',
      createdAt: ago(26),
      due: dueIn(1),
      status: 'waiting-approval',
      lastSignalAt: ago(2),
      events: [
        ev(26, 'created', 'me', 'Agent-Job gestartet'),
        ev(2, 'update', 'review-agent', 'Checkup bestanden: 42 Tests grün, keine offenen Findings. Merge wartet auf Freigabe.'),
      ],
    },
    {
      id: 'd9',
      title: 'Testfälle für den Audit-Trail-Export schreiben',
      recipientId: 'sophie',
      project: 'lims-qualifizierung',
      source: 'polarion',
      sourceRef: 'DEMO-P-7802',
      createdAt: ago(24 * 5),
      due: dueIn(5),
      status: 'in-progress',
      lastSignalAt: ago(22),
      events: [ev(24 * 5, 'created', 'me', 'Delegiert aus Polarion'), ev(22, 'update', 'sophie', '12 von 18 Testfällen sind beschrieben.')],
    },
    {
      id: 'd10',
      title: 'Release-Notes 4.2 entwerfen',
      recipientId: 'doku-agent',
      project: 'release-4-2',
      source: 'atlas',
      sourceRef: 'DEMO-1219',
      createdAt: ago(8),
      due: dueIn(7),
      status: 'in-progress',
      lastSignalAt: ago(1),
      events: [ev(8, 'created', 'me', 'Agent-Job gestartet'), ev(1, 'update', 'doku-agent', 'Gliederung steht, 14 von 31 Records ausgewertet.')],
    },
    {
      id: 'd11',
      title: 'Preisstaffel für Wartungsverträge kalkulieren',
      recipientId: 'aylin',
      project: 'pilotkunden',
      source: 'mail',
      sourceRef: `vom ${dayLabel(6)}`,
      createdAt: ago(24 * 6),
      due: dueIn(9),
      status: 'in-progress',
      lastSignalAt: ago(26),
      events: [ev(24 * 6, 'created', 'me', 'Per Mail delegiert'), ev(26, 'update', 'aylin', 'Erste Kalkulation steht, Vertrieb prüft die Annahmen.')],
    },
    {
      id: 'd12',
      title: 'Befunde aus dem Pen-Test nachverfolgen',
      recipientId: 'jonas',
      project: 'release-4-2',
      source: 'jira',
      sourceRef: 'DEMO-SEC-57',
      createdAt: ago(24 * 10),
      due: dueIn(2),
      status: 'in-progress',
      lastSignalAt: ago(36),
      events: [ev(24 * 10, 'created', 'me', 'Delegiert aus Jira'), ev(36, 'update', 'jonas', 'Zwei Befunde sind behoben und verifiziert.')],
    },
    {
      id: 'd13',
      title: 'Wettbewerbsanalyse Probenmanagement',
      recipientId: 'recherche-agent',
      project: 'pilotkunden',
      source: 'atlas',
      sourceRef: 'DEMO-1224',
      createdAt: ago(20),
      due: dueIn(3),
      status: 'in-progress',
      lastSignalAt: ago(4),
      events: [ev(20, 'created', 'me', 'Agent-Job gestartet'), ev(4, 'update', 'recherche-agent', 'Sieben Anbieter erfasst, Vergleichstabelle in Arbeit.')],
    },
    {
      id: 'd14',
      title: 'Kalibrierintervalle im LIMS prüfen',
      recipientId: 'sophie',
      project: 'lims-qualifizierung',
      source: 'atlas',
      sourceRef: 'DEMO-1196',
      createdAt: ago(24 * 3),
      due: dueIn(8),
      status: 'open',
      lastSignalAt: ago(26),
      events: [
        ev(24 * 3, 'created', 'me', 'Delegiert per Satz, in Atlas angelegt'),
        ev(26, 'update', 'sophie', 'Geräteliste ist exportiert, die Prüfung startet am Montag.'),
      ],
    },
    {
      id: 'd15',
      title: 'Schulungsunterlagen GMP-Grundlagen',
      recipientId: 'lena',
      project: 'lims-qualifizierung',
      source: 'atlas',
      sourceRef: 'DEMO-1150',
      createdAt: ago(24 * 14),
      due: dueIn(-1),
      status: 'done',
      doneAt: ago(48),
      lastSignalAt: ago(48),
      events: [ev(24 * 14, 'created', 'me', 'Delegiert'), ev(48, 'done', 'lena', 'Unterlagen freigegeben und im Schulungsportal.')],
    },
    {
      id: 'd16',
      title: 'Dependency-Scan Release 4.1.3',
      recipientId: 'review-agent',
      project: 'release-4-2',
      source: 'atlas',
      sourceRef: 'DEMO-1179',
      createdAt: ago(24 * 2),
      due: dueIn(0),
      status: 'done',
      doneAt: ago(20),
      lastSignalAt: ago(20),
      events: [ev(24 * 2, 'created', 'me', 'Agent-Job gestartet'), ev(20, 'done', 'review-agent', 'Scan ohne kritische Befunde, Bericht am Record.')],
    },
    {
      id: 'd17',
      title: 'Angebot für den Kalibrierservice einholen',
      recipientId: 'tobias',
      project: 'probenwechsler',
      source: 'mail',
      sourceRef: `vom ${dayLabel(11)}`,
      createdAt: ago(24 * 11),
      due: dueIn(-2),
      status: 'done',
      doneAt: ago(24 * 3),
      lastSignalAt: ago(24 * 3),
      events: [ev(24 * 11, 'created', 'me', 'Per Mail delegiert'), ev(24 * 3, 'done', 'tobias', 'Zwei Angebote liegen vor, Vergleich im Anhang.')],
    },
  ];

  const blockers: Blocker[] = [
    {
      id: 'b1',
      kind: 'approval',
      title: 'Trace-Links in 38 Polarion-Items schreiben',
      detail: 'Kritischer Schritt. Der Agent hat den Abgleich vorbereitet und schreibt erst nach Freigabe: 38 neue Links, keine Löschungen.',
      requestedBy: 'trace-agent',
      since: ago(3),
      delegationId: 'd6',
    },
    {
      id: 'b2',
      kind: 'approval',
      title: 'Login-Modul in main mergen',
      detail: 'Kritischer Schritt. Checkup bestanden: 42 Tests grün, keine offenen Findings.',
      requestedBy: 'review-agent',
      since: ago(2),
      delegationId: 'd8',
    },
    {
      id: 'b3',
      kind: 'decision',
      title: 'Lizenz verlängern oder Alternative prüfen?',
      detail: 'Die Lizenz der Testautomatisierung ist abgelaufen. Ohne Entscheidung verschiebt sich die Testumgebung für Release 4.2.',
      requestedBy: 'jonas',
      since: ago(20),
      delegationId: 'd2',
      options: ['Lizenz verlängern', 'Alternative prüfen'],
    },
    {
      id: 'b4',
      kind: 'input',
      title: 'Meine Verfügbarkeit für das Lieferantenaudit',
      detail: `Lena braucht zwei mögliche Termine in KW ${isoWeek(addDays(today, 14))}.`,
      requestedBy: 'lena',
      since: ago(24 * 4 + 2),
      delegationId: 'd4',
      suggestedInput: 'Dienstag und Donnerstag vormittags passen, Mittwoch bin ich ganztägig belegt.',
    },
    {
      id: 'b5',
      kind: 'decision',
      title: 'Go oder No-Go für den Feature-Freeze 4.2',
      detail: `Offen aus der Produktrunde vom ${dayLabel(4)}. Zwei Features sind knapp fertig.`,
      requestedBy: 'aylin',
      since: ago(24 * 4),
      options: ['Go: Freeze wie geplant', 'No-Go: eine Woche später'],
    },
  ];

  return { workspaces: DEMO_WORKSPACES, recipients: DEMO_RECIPIENTS, delegations, blockers, settings: { staleDays: 3 } };
}
