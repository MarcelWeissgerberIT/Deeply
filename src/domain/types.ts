/**
 * Domain model of the Delegations-Cockpit.
 *
 * The shapes mirror what Atlas already provides: records with assignee (owner),
 * due date, status and last update; agent jobs; approvals. The cockpit only
 * reads and reacts to these. It does not run its own task management.
 */

export type RecipientKind = 'person' | 'agent';

export interface Recipient {
  id: string;
  name: string;
  kind: RecipientKind;
  /** Role or team for people, purpose for agents. */
  role: string;
  /** Only for agents: whom the agent acts for. */
  owner?: string;
}

/** A project inside an Atlas tenant (workspace). */
export interface Project {
  slug: string;
  title: string;
}

/** An Atlas tenant (workspace) with its projects. */
export interface Workspace {
  slug: string;
  title: string;
  projects: Project[];
}

/** System the delegated work lives in. The cockpit links there, it never copies. */
export type Source = 'atlas' | 'jira' | 'polarion' | 'mail' | 'meeting';

export type DelegationStatus =
  | 'open'
  | 'in-progress'
  | 'blocked'
  | 'waiting-approval'
  | 'done';

export type EventKind =
  | 'created'
  | 'update'
  | 'follow-up'
  | 'reply'
  | 'escalation'
  | 'approved'
  | 'rejected'
  | 'decision'
  | 'input'
  | 'done';

export interface TimelineEvent {
  /** ISO timestamp. */
  at: string;
  kind: EventKind;
  /** Recipient id, 'me' for the cockpit owner, or 'system' for the source system itself. */
  actor: string;
  text: string;
}

export type FollowUpState = 'sent' | 'answered' | 'escalated';

export interface FollowUp {
  state: FollowUpState;
  /** ISO timestamp of the last status request. */
  sentAt: string;
}

export interface Delegation {
  id: string;
  title: string;
  recipientId: string;
  /** Slug of the Atlas project the work belongs to. */
  project: string;
  source: Source;
  /** Reference in the source system (Atlas ref, Jira key, Polarion id, …). */
  sourceRef: string;
  /** Status as the source system names it, when it differs from the cockpit's status. */
  sourceStatus?: string;
  context?: string;
  createdAt?: string;
  /** Deadline as calendar date YYYY-MM-DD, or null when the source has none. */
  due: string | null;
  status: DelegationStatus;
  /** Reason shown when the status is blocked. */
  blockedReason?: string;
  /** ISO timestamp of the last sign of life from the owner. */
  lastSignalAt: string;
  /** ISO timestamp when the work was completed. */
  doneAt?: string;
  followUp?: FollowUp;
  events: TimelineEvent[];
}

export type BlockerKind = 'approval' | 'decision' | 'input';

/** Something another person or agent is waiting on me for. */
export interface Blocker {
  id: string;
  kind: BlockerKind;
  title: string;
  detail: string;
  requestedBy: string;
  /** ISO timestamp since when they wait. */
  since: string;
  delegationId?: string;
  /** Decision blockers: the options to choose from. */
  options?: string[];
  /** Input blockers: a prefilled answer that can be sent with one click. */
  suggestedInput?: string;
}

export type Light = 'red' | 'yellow' | 'green' | 'done';

export interface Assessment {
  light: Light;
  /** Short German explanation, e.g. "überfällig seit 2 Tagen". */
  reason: string;
}

export interface AssessedDelegation {
  delegation: Delegation;
  assessment: Assessment;
}

export interface Settings {
  /** Days without an update after which a delegation turns yellow. */
  staleDays: number;
}
