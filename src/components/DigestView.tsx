/** Wochen-Digest: done, endangered, needs me. Replaces the weekly status round. */
import { useRef, useState } from 'react';
import { digestToText, type Digest } from '../domain/digest';
import { BLOCKER_LABEL } from '../domain/labels';
import type { Recipient } from '../domain/types';
import { LightChip } from './LightChip';

interface Props {
  digest: Digest;
  recipients: Recipient[];
  recipientOf: (id: string) => Recipient;
  onOpen: (delegationId: string) => void;
}

export function DigestView({ digest, recipients, recipientOf, onOpen }: Props) {
  const text = digestToText(digest, recipients);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const red = digest.atRisk.filter((r) => r.assessment.light === 'red').length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch (error) {
      console.warn('Zwischenablage nicht verfügbar, Text wird zum manuellen Kopieren markiert.', error);
      setCopyState('manual');
      const area = textRef.current;
      if (area) {
        area.closest('details')?.setAttribute('open', '');
        area.focus();
        area.select();
      }
    }
  }

  return (
    <section className="view" aria-labelledby="digest-title">
      <header className="view__head">
        <div>
          <h1 id="digest-title">Wochen-Digest</h1>
          <p className="view__lead">
            <span className="mono">{digest.weekLabel}</span> · letzte sieben Tage ({digest.periodLabel}). Statt Statusrunde.
          </p>
        </div>
        <div className="digest__copy">
          <button type="button" className="btn btn--primary" onClick={copy}>
            Als Text kopieren
          </button>
          <span className="digest__copy-state" role="status">
            {copyState === 'copied' ? 'Kopiert.' : copyState === 'manual' ? 'Text ist markiert, bitte mit Strg+C kopieren.' : ''}
          </span>
        </div>
      </header>

      <div className="digest__summary">
        <Figure value={digest.done.length} label="erledigt" tone="done" />
        <Figure value={red} label="kritisch" tone="red" />
        <Figure value={digest.atRisk.length - red} label="gefährdet" tone="yellow" />
        <Figure value={digest.needsMe.length} label="brauchen mich" tone="accent" />
      </div>

      <div className="digest__grid">
        <section className="digest__col" aria-labelledby="dg-done">
          <h2 id="dg-done">Erledigt</h2>
          {digest.done.length === 0 ? (
            <p className="empty">Diese Woche nichts abgeschlossen.</p>
          ) : (
            <ul>
              {digest.done.map((d) => (
                <li key={d.id}>
                  <button type="button" className="link" onClick={() => onOpen(d.id)}>
                    {d.title}
                  </button>
                  <span className="digest__by">{recipientOf(d.recipientId).name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="digest__col" aria-labelledby="dg-risk">
          <h2 id="dg-risk">Gefährdet</h2>
          {digest.atRisk.length === 0 ? (
            <p className="empty">Nichts gefährdet.</p>
          ) : (
            <ul>
              {digest.atRisk.map(({ delegation: d, assessment }) => (
                <li key={d.id}>
                  <button type="button" className="link" onClick={() => onOpen(d.id)}>
                    {d.title}
                  </button>
                  <span className="digest__by">{recipientOf(d.recipientId).name}</span>
                  <LightChip assessment={assessment} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="digest__col" aria-labelledby="dg-me">
          <h2 id="dg-me">Braucht mich</h2>
          {digest.needsMe.length === 0 ? (
            <p className="empty">Niemand wartet auf mich.</p>
          ) : (
            <ul>
              {digest.needsMe.map((b) => (
                <li key={b.id}>
                  <span className={`kind kind--${b.kind}`}>{BLOCKER_LABEL[b.kind]}</span>
                  <span className="digest__item-title">{b.title}</span>
                  <span className="digest__by">
                    {recipientOf(b.requestedBy).name} · wartet seit {digest.waiting[b.id]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <details className="digest__text">
        <summary>Textfassung für Mail oder Chat</summary>
        <label className="sr-only" htmlFor="digest-text">
          Digest als Text
        </label>
        <textarea id="digest-text" ref={textRef} readOnly rows={18} value={text} />
      </details>
    </section>
  );
}

function Figure({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="figure" data-tone={tone}>
      <span className="figure__value">{value}</span>
      <span className="figure__label">{label}</span>
    </div>
  );
}
