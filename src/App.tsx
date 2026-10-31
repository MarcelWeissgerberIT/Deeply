/**
 * Delegations-Cockpit: shell, navigation and wiring between views and state.
 * Default view shows only exceptions (red and yellow); green stays out of the way.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlockerPanel } from './components/BlockerPanel';
import { CommandBar } from './components/CommandBar';
import { DelegationDrawer } from './components/DelegationDrawer';
import { DelegationList, type Row } from './components/DelegationList';
import { DigestView } from './components/DigestView';
import { FollowUpPanel } from './components/FollowUpPanel';
import { Segmented } from './components/Segmented';
import { TeamView } from './components/TeamView';
import { DEMO_EXAMPLES, demoReply } from './data/demo';
import { snapshotExamples, type DataInfo } from './data/snapshot';
import { assess, compareByUrgency, isException } from './domain/ampel';
import { formatShortDate, formatStamp, parseDateOnly } from './domain/dates';
import { buildDigest } from './domain/digest';
import { composeRequest, planFollowUps } from './domain/followUp';
import { suggestProject } from './domain/grouping';
import type { DelegationDraft } from './domain/parseDelegation';
import type { Blocker, Recipient, RecipientKind } from './domain/types';
import type { CockpitState, Resolution } from './state/cockpit';
import { useCockpit } from './state/useCockpit';

type View = 'cockpit' | 'team' | 'digest';
const VIEWS: { id: View; label: string }[] = [
  { id: 'cockpit', label: 'Cockpit' },
  { id: 'team', label: 'Team & Agenten' },
  { id: 'digest', label: 'Wochen-Digest' },
];

type Scope = 'exceptions' | 'open' | 'done';
type KindFilter = 'all' | RecipientKind;
type Grouping = 'tenant' | 'flat';

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
  openId?: string;
}

/** Demo only: delay before a simulated answer arrives. */
const DEMO_REPLY_DELAY_MS = { person: 2600, agent: 1400 } as const;

function viewFromHash(): View {
  const hash = window.location.hash.replace('#', '');
  return VIEWS.some((v) => v.id === hash) ? (hash as View) : 'cockpit';
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function App({ initial }: { initial: { state: CockpitState; info: DataInfo } }) {
  const now = useNow(60_000);
  const { state, apply } = useCockpit(() => initial.state);
  const info = initial.info;
  const isDemo = info.kind === 'demo';
  const [view, setView] = useState<View>(viewFromHash);
  const [scope, setScope] = useState<Scope>('exceptions');
  const [kind, setKind] = useState<KindFilter>('all');
  const [grouping, setGrouping] = useState<Grouping>('tenant');
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastCounter = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((text: string, tone: Toast['tone'] = 'info', openTarget?: string) => {
    toastCounter.current += 1;
    setToast({ id: toastCounter.current, text, tone, openId: openTarget });
  }, []);

  const recipientById = useMemo(() => new Map(state.recipients.map((r) => [r.id, r])), [state.recipients]);
  const recipientOf = useCallback(
    (id: string): Recipient => {
      const r = recipientById.get(id);
      if (!r) throw new Error(`Empfänger „${id}“ nicht gefunden.`);
      return r;
    },
    [recipientById],
  );

  const rows: Row[] = useMemo(
    () =>
      state.delegations
        .map((delegation) => ({ delegation, assessment: assess(delegation, now, state.settings) }))
        .sort(compareByUrgency),
    [state.delegations, state.settings, now],
  );
  const plans = useMemo(() => planFollowUps(state.delegations, now, state.settings), [state.delegations, state.settings, now]);
  const digest = useMemo(
    () => buildDigest(state.delegations, state.blockers, now, state.settings),
    [state.delegations, state.blockers, state.settings, now],
  );

  const examples = useMemo(
    () => (isDemo ? DEMO_EXAMPLES : snapshotExamples(state.recipients, now)),
    [isDemo, state.recipients, now],
  );
  const proposeProject = useCallback(
    (recipientId: string) => suggestProject(state.delegations, recipientId, state.workspaces),
    [state.delegations, state.workspaces],
  );

  const counts = {
    red: rows.filter((r) => r.assessment.light === 'red').length,
    yellow: rows.filter((r) => r.assessment.light === 'yellow').length,
    green: rows.filter((r) => r.assessment.light === 'green').length,
    done: rows.filter((r) => r.assessment.light === 'done').length,
  };

  const byKind = rows.filter((r) => kind === 'all' || recipientOf(r.delegation.recipientId).kind === kind);
  const visible = byKind.filter((r) => {
    if (scope === 'exceptions') return isException(r.assessment);
    if (scope === 'open') return r.assessment.light !== 'done';
    return r.assessment.light === 'done';
  });

  // --- actions -------------------------------------------------------------

  function delegate(draft: DelegationDraft, project: string): boolean {
    const id = crypto.randomUUID();
    const error = apply({ type: 'delegate', id, draft, project, now: new Date().toISOString() });
    if (error) {
      notify(error, 'error');
      return false;
    }
    const who = recipientOf(draft.recipientId).name;
    const where = isDemo ? 'In Atlas angelegt (Demo: nur lokal).' : 'Nur in dieser Vorschau angelegt, nicht in Atlas.';
    notify(`Delegiert an ${who}, Frist ${formatShortDate(parseDateOnly(draft.due))}. ${where}`, 'info', id);
    return true;
  }

  function sendFollowUps(ids: string[]) {
    if (!isDemo) {
      notify('In der Vorschau mit echten Daten wird nichts gesendet.', 'error');
      return;
    }
    for (const id of ids) {
      const d = state.delegations.find((x) => x.id === id);
      if (!d) {
        notify(`Delegation „${id}“ nicht gefunden.`, 'error');
        continue;
      }
      const recipient = recipientOf(d.recipientId);
      const error = apply({ type: 'followUpSent', delegationId: id, message: composeRequest(d, recipient), now: new Date().toISOString() });
      if (error) {
        notify(error, 'error');
        continue;
      }
      const timer = window.setTimeout(() => {
        const replyError = apply({ type: 'replyReceived', delegationId: id, text: demoReply(id, recipient), now: new Date().toISOString() });
        if (replyError) notify(replyError, 'error');
        else notify(`Antwort von ${recipient.name} ist als Update eingegangen.`, 'info', id);
      }, DEMO_REPLY_DELAY_MS[recipient.kind]);
      timers.current.push(timer);
    }
    notify(ids.length === 1 ? 'Nachfrage gesendet.' : `${ids.length} Nachfragen gesendet.`);
  }

  function escalate(id: string) {
    const error = apply({ type: 'escalate', delegationId: id, now: new Date().toISOString() });
    notify(error ?? 'Eskaliert. Die Delegation steht jetzt auf Rot.', error ? 'error' : 'info', error ? undefined : id);
  }

  function resolve(blocker: Blocker, resolution: Resolution) {
    const error = apply({ type: 'resolveBlocker', blockerId: blocker.id, resolution, now: new Date().toISOString() });
    if (error) {
      notify(error, 'error');
      return;
    }
    const who = recipientOf(blocker.requestedBy).name;
    const text =
      resolution.kind === 'approve'
        ? `Freigegeben. ${who} macht weiter.`
        : resolution.kind === 'reject'
          ? `Abgelehnt. ${who} führt den Schritt nicht aus.`
          : resolution.kind === 'decide'
            ? `Entschieden: ${resolution.option}. ${who} ist informiert.`
            : `Input an ${who} gesendet.`;
    notify(text, 'info', blocker.delegationId);
  }

  function setStaleDays(days: number) {
    const error = apply({ type: 'setStaleDays', days });
    if (error) notify(error, 'error');
  }

  const closeDrawer = useCallback(() => setOpenId(null), []);
  const openRow = openId ? rows.find((r) => r.delegation.id === openId) : undefined;
  const canAsk = (id: string) => {
    const d = state.delegations.find((x) => x.id === id);
    if (!d) return false;
    return (
      isDemo &&
      d.status !== 'done' &&
      d.status !== 'waiting-approval' &&
      d.followUp?.state !== 'sent' &&
      d.followUp?.state !== 'escalated'
    );
  };

  // --- render --------------------------------------------------------------

  return (
    <div className="app">
      <header className="panel">
        <div className="panel__inner">
          <div className="topline">
            <a className="brand" href="#cockpit" aria-label="Delegations-Cockpit, Startansicht">
              <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
                <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M16 16 L25 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="16" cy="16" r="2.6" fill="currentColor" />
                <path d="M6.5 20.5 A10 10 0 0 1 8 10.5" stroke="var(--sig-red)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
              </svg>
              <span className="brand__name">Delegations-Cockpit</span>
              <span className="brand__module">Atlas-Modul</span>
            </a>
            <nav className="nav" aria-label="Ansichten">
              {VIEWS.map((v) => (
                <a key={v.id} href={`#${v.id}`} className="nav__link" aria-current={view === v.id ? 'page' : undefined}>
                  {v.label}
                </a>
              ))}
            </nav>
            {isDemo ? (
              <span className="demo-badge" title="Erfundene Beispieldaten, keine Verbindung zu Atlas">
                Demo-Daten
              </span>
            ) : (
              <span className="demo-badge demo-badge--live" title="Stand aus Atlas, nur lesend. Nichts wird gesendet.">
                Atlas-Stand {info.kind === 'snapshot' ? formatStamp(info.takenAt) : ''} · nur lesen
              </span>
            )}
          </div>

          <CommandBar
            recipients={state.recipients}
            workspaces={state.workspaces}
            now={now}
            examples={examples}
            suggestProject={proposeProject}
            onDelegate={delegate}
          />

          <div className="readouts" role="group" aria-label="Lage">
            <Readout tone="red" value={counts.red} label="Rot" hint="überfällig oder blockiert" />
            <Readout tone="yellow" value={counts.yellow} label="Gelb" hint={`${state.settings.staleDays} ${state.settings.staleDays === 1 ? 'Tag' : 'Tage'} ohne Update oder wartet auf mich`} />
            <Readout tone="green" value={counts.green} label="Grün" hint="läuft" />
            <Readout tone="accent" value={state.blockers.length} label="Braucht mich" hint="Freigaben, Entscheidungen, Inputs" />
          </div>
        </div>
      </header>

      <main className="page">
        {view === 'cockpit' && (
          <div className="cockpit">
            <section className="deleg" aria-labelledby="deleg-title">
              <div className="deleg__head">
                <h1 id="deleg-title">{scope === 'exceptions' ? 'Ausnahmen' : scope === 'open' ? 'Alle offenen Delegationen' : 'Erledigt'}</h1>
                <div className="deleg__controls">
                  <Segmented
                    label="Umfang"
                    value={scope}
                    onChange={setScope}
                    options={[
                      { value: 'exceptions', label: 'Ausnahmen', count: counts.red + counts.yellow },
                      { value: 'open', label: 'Alle offenen', count: counts.red + counts.yellow + counts.green },
                      { value: 'done', label: 'Erledigt', count: counts.done },
                    ]}
                  />
                  <Segmented
                    label="Empfänger"
                    value={kind}
                    onChange={setKind}
                    options={[
                      { value: 'all', label: 'Alle' },
                      { value: 'person', label: 'Menschen' },
                      { value: 'agent', label: 'Agenten' },
                    ]}
                  />
                  <Segmented
                    label="Gruppierung"
                    value={grouping}
                    onChange={setGrouping}
                    options={[
                      { value: 'tenant', label: 'Tenant › Projekt' },
                      { value: 'flat', label: 'Liste' },
                    ]}
                  />
                  <label className="threshold" htmlFor="stale-days">
                    Gelb nach
                    <select id="stale-days" value={state.settings.staleDays} onChange={(e) => setStaleDays(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5, 7, 10, 14].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    {state.settings.staleDays === 1 ? 'Tag' : 'Tagen'} ohne Update
                  </label>
                </div>
              </div>
              <DelegationList
                rows={visible}
                grouped={grouping === 'tenant'}
                workspaces={state.workspaces}
                now={now}
                recipientOf={recipientOf}
                onOpen={setOpenId}
                emptyText={
                  scope === 'exceptions'
                    ? 'Keine Ausnahmen. Alles Delegierte läuft, ich muss gerade nicht daran denken.'
                    : scope === 'done'
                      ? 'In diesem Filter ist nichts erledigt.'
                      : 'Keine offenen Delegationen in diesem Filter.'
                }
              />
              {scope === 'exceptions' && counts.green > 0 && (
                <p className="deleg__green">
                  {counts.green} weitere {counts.green === 1 ? 'läuft' : 'laufen'} auf Grün und {counts.green === 1 ? 'bleibt' : 'bleiben'} ausgeblendet.{' '}
                  <button type="button" className="link" onClick={() => setScope('open')}>
                    Alle zeigen
                  </button>
                </p>
              )}
            </section>
            <aside className="rail" aria-label="Was mich braucht">
              <BlockerPanel
                blockers={state.blockers}
                delegations={state.delegations}
                now={now}
                recipientOf={recipientOf}
                onResolve={resolve}
                onOpen={setOpenId}
              />
              <FollowUpPanel
                plans={plans}
                delegations={state.delegations}
                now={now}
                recipientOf={recipientOf}
                canSend={isDemo}
                footnote={
                  isDemo
                    ? 'Demo: Antworten werden nach wenigen Sekunden simuliert.'
                    : 'Vorschau mit echten Daten: Nachfragen werden nicht gesendet.'
                }
                onSend={sendFollowUps}
                onEscalate={escalate}
                onOpen={setOpenId}
              />
            </aside>
          </div>
        )}
        {view === 'team' && <TeamView recipients={state.recipients} rows={rows} blockers={state.blockers} onOpen={setOpenId} />}
        {view === 'digest' && (
          <DigestView digest={digest} recipients={state.recipients} workspaces={state.workspaces} recipientOf={recipientOf} onOpen={setOpenId} />
        )}
      </main>

      {openRow && (
        <DelegationDrawer
          delegation={openRow.delegation}
          assessment={openRow.assessment}
          now={now}
          workspaces={state.workspaces}
          recipientOf={recipientOf}
          canAsk={canAsk(openRow.delegation.id)}
          onAsk={(id) => sendFollowUps([id])}
          onClose={closeDrawer}
        />
      )}

      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" data-tone={toast.tone} key={toast.id}>
            <span>{toast.text}</span>
            {toast.openId && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  setOpenId(toast.openId ?? null);
                  setToast(null);
                }}
              >
                Öffnen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Readout({ tone, value, label, hint }: { tone: string; value: number; label: string; hint: string }) {
  return (
    <div className="readout" data-tone={tone}>
      <span className="readout__value">{value}</span>
      <span className="readout__text">
        <span className="readout__label">{label}</span>
        <span className="readout__hint">{hint}</span>
      </span>
    </div>
  );
}
