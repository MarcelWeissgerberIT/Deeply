/** Delegieren per Satz: one sentence creates the delegation with owner, deadline and context. */
import { useId, useState, type FormEvent } from 'react';
import { formatShortDate, parseDateOnly } from '../domain/dates';
import { MAX_SENTENCE_LENGTH, parseDelegation, type DelegationDraft } from '../domain/parseDelegation';
import type { Recipient, Workspace } from '../domain/types';

interface Props {
  recipients: Recipient[];
  workspaces: Workspace[];
  now: Date;
  /** Clickable example sentences shown while the field is empty. */
  examples: string[];
  /** Project proposed for a recipient (where they already work most). */
  suggestProject: (recipientId: string) => string;
  onDelegate: (draft: DelegationDraft, project: string) => boolean;
}

export function CommandBar({ recipients, workspaces, now, examples, suggestProject, onDelegate }: Props) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  /** Explicit project choice, remembered per recipient until the sentence is sent. */
  const [chosen, setChosen] = useState<{ recipientId: string; project: string } | null>(null);
  const hintId = useId();
  const result = parseDelegation(text, recipients, now);
  const nameOf = (id: string) => recipients.find((r) => r.id === id)?.name ?? id;
  const project = result.ok
    ? chosen?.recipientId === result.draft.recipientId
      ? chosen.project
      : suggestProject(result.draft.recipientId)
    : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (result.ok && project && onDelegate(result.draft, project)) {
      setText('');
      setSubmitted(false);
      setChosen(null);
    }
  }

  return (
    <form className="command" onSubmit={submit} noValidate>
      <label className="command__label" htmlFor="delegate-sentence">
        Delegieren per Satz
      </label>
      <div className="command__row">
        <input
          id="delegate-sentence"
          className="command__input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_SENTENCE_LENGTH + 20}
          placeholder={examples[0] ?? 'Gib X an Y bis Freitag'}
          value={text}
          aria-describedby={hintId}
          aria-invalid={submitted && !result.ok}
          onChange={(e) => {
            setText(e.target.value);
            setSubmitted(false);
          }}
        />
        <button className="btn btn--primary command__go" type="submit" disabled={!text.trim()}>
          Delegieren
        </button>
      </div>
      <div id={hintId} className="command__hint" aria-live="polite">
        {!text.trim() ? (
          <div className="command__examples">
            <span>Zum Beispiel:</span>
            {examples.map((example) => (
              <button key={example} type="button" className="command__example" onClick={() => setText(example)}>
                {example}
              </button>
            ))}
          </div>
        ) : result.ok ? (
          <dl className="command__parsed">
            <div>
              <dt>Aufgabe</dt>
              <dd>{result.draft.title}</dd>
            </div>
            <div>
              <dt>an</dt>
              <dd>{nameOf(result.draft.recipientId)}</dd>
            </div>
            <div>
              <dt>bis</dt>
              <dd className="mono">{formatShortDate(parseDateOnly(result.draft.due))}</dd>
            </div>
            <div className="command__project">
              <dt>
                <label htmlFor="delegate-project">Projekt</label>
              </dt>
              <dd>
                <select
                  id="delegate-project"
                  value={project ?? ''}
                  onChange={(e) => setChosen({ recipientId: result.draft.recipientId, project: e.target.value })}
                >
                  {workspaces.map((w) => (
                    <optgroup key={w.slug} label={w.title}>
                      {w.projects.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </dd>
            </div>
            {result.draft.context && (
              <div>
                <dt>Kontext</dt>
                <dd>{result.draft.context}</dd>
              </div>
            )}
            <div className="command__enter">Enter legt die Aufgabe in Atlas an</div>
          </dl>
        ) : (
          <p className={submitted ? 'command__error' : 'command__pending'}>{result.error}</p>
        )}
      </div>
    </form>
  );
}
