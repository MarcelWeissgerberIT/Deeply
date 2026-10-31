/** Delegieren per Satz: one sentence creates the delegation with owner, deadline and context. */
import { useId, useState, type FormEvent } from 'react';
import { formatShortDate, parseDateOnly } from '../domain/dates';
import { MAX_SENTENCE_LENGTH, parseDelegation, type DelegationDraft } from '../domain/parseDelegation';
import type { Recipient } from '../domain/types';

interface Props {
  recipients: Recipient[];
  now: Date;
  /** Clickable example sentences shown while the field is empty. */
  examples: string[];
  onDelegate: (draft: DelegationDraft) => boolean;
}

export function CommandBar({ recipients, now, examples, onDelegate }: Props) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const hintId = useId();
  const result = parseDelegation(text, recipients, now);
  const nameOf = (id: string) => recipients.find((r) => r.id === id)?.name ?? id;

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (result.ok && onDelegate(result.draft)) {
      setText('');
      setSubmitted(false);
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
          placeholder="Gib die Risikoanalyse an Lena bis Freitag"
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
