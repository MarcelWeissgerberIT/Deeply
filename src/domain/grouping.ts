/**
 * Groups delegations by Atlas tenant (workspace) and project, so the cockpit
 * shows where the delegated work lives. Most critical groups come first.
 */
import type { AssessedDelegation, Delegation, Light, Project, Workspace } from './types';

export type LightCounts = Record<Light, number>;

export interface ProjectGroup {
  project: Project;
  rows: AssessedDelegation[];
  counts: LightCounts;
}

export interface WorkspaceGroup {
  workspace: Workspace;
  projects: ProjectGroup[];
  counts: LightCounts;
}

function countLights(rows: AssessedDelegation[]): LightCounts {
  const counts: LightCounts = { red: 0, yellow: 0, green: 0, done: 0 };
  for (const r of rows) counts[r.assessment.light] += 1;
  return counts;
}

function bySeverity(a: { counts: LightCounts; title: string }, b: { counts: LightCounts; title: string }): number {
  return b.counts.red - a.counts.red || b.counts.yellow - a.counts.yellow || a.title.localeCompare(b.title, 'de');
}

/** Rows keep their incoming order inside each project. */
export function groupByWorkspace(rows: AssessedDelegation[], workspaces: Workspace[]): WorkspaceGroup[] {
  const owner = new Map<string, { workspace: Workspace; project: Project }>();
  for (const workspace of workspaces) {
    for (const project of workspace.projects) owner.set(project.slug, { workspace, project });
  }

  const buckets = new Map<string, Map<string, AssessedDelegation[]>>();
  for (const row of rows) {
    const home = owner.get(row.delegation.project);
    if (!home) throw new Error(`Projekt „${row.delegation.project}“ gehört zu keinem Tenant.`);
    const projects = buckets.get(home.workspace.slug) ?? new Map<string, AssessedDelegation[]>();
    projects.set(home.project.slug, [...(projects.get(home.project.slug) ?? []), row]);
    buckets.set(home.workspace.slug, projects);
  }

  return workspaces
    .filter((w) => buckets.has(w.slug))
    .map((workspace) => {
      const projects = workspace.projects
        .filter((p) => buckets.get(workspace.slug)!.has(p.slug))
        .map((project) => {
          const projectRows = buckets.get(workspace.slug)!.get(project.slug)!;
          return { project, rows: projectRows, counts: countLights(projectRows) };
        })
        .sort((a, b) => bySeverity({ ...a, title: a.project.title }, { ...b, title: b.project.title }));
      return { workspace, projects, counts: countLights(projects.flatMap((p) => p.rows)) };
    })
    .sort((a, b) => bySeverity({ ...a, title: a.workspace.title }, { ...b, title: b.workspace.title }));
}

/** "Kunde A › Release" */
export function projectLabel(projectSlug: string, workspaces: Workspace[]): string {
  for (const w of workspaces) {
    const p = w.projects.find((x) => x.slug === projectSlug);
    if (p) return `${w.title} › ${p.title}`;
  }
  throw new Error(`Projekt „${projectSlug}“ gehört zu keinem Tenant.`);
}

/** Default project for a new delegation: where the recipient already works most. */
export function suggestProject(delegations: Delegation[], recipientId: string, workspaces: Workspace[]): string {
  const tally = new Map<string, number>();
  for (const d of delegations) {
    if (d.recipientId === recipientId) tally.set(d.project, (tally.get(d.project) ?? 0) + 1);
  }
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best) return best[0];
  const first = workspaces[0]?.projects[0];
  if (!first) throw new Error('Es gibt kein Projekt, in das delegiert werden kann.');
  return first.slug;
}
