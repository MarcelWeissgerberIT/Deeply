/** German display labels for the domain enums. */
import type { BlockerKind, DelegationStatus, Light, Source } from './types';

export const BLOCKER_LABEL: Record<BlockerKind, string> = {
  approval: 'Freigabe',
  decision: 'Entscheidung',
  input: 'Input',
};

export const SOURCE_LABEL: Record<Source, string> = {
  atlas: 'Atlas',
  jira: 'Jira',
  polarion: 'Polarion',
  mail: 'Mail',
  meeting: 'Meeting',
};

export const STATUS_LABEL: Record<DelegationStatus, string> = {
  open: 'offen',
  'in-progress': 'in Arbeit',
  blocked: 'blockiert',
  'waiting-approval': 'wartet auf Freigabe',
  done: 'erledigt',
};

export const LIGHT_LABEL: Record<Light, string> = {
  red: 'Rot',
  yellow: 'Gelb',
  green: 'Grün',
  done: 'Erledigt',
};

/** Sources whose refs are system keys (shown in mono); the others carry a readable description. */
export const KEYED_SOURCES: ReadonlySet<Source> = new Set<Source>(['atlas', 'jira', 'polarion']);
