/**
 * Delegieren per Satz: turns "Gib X an Y bis Freitag" into a delegation draft
 * with title, recipient (person or agent), deadline and optional context.
 * Every failure returns a concrete German hint instead of a guess.
 */
import { parseDateOnly, startOfDay } from './dates';
import { parseDeadline } from './parseDeadline';
import type { Recipient } from './types';

export interface DelegationDraft {
  title: string;
  recipientId: string;
  due: string;
  context?: string;
}

export type ParseResult = { ok: true; draft: DelegationDraft } | { ok: false; error: string };

export const MAX_SENTENCE_LENGTH = 300;

const EXAMPLE = '„Gib X an Y bis Freitag“';
const VERBS = 'gib|gebe|übergib|übergebe|delegiere|schick|schicke|sende|überlasse';
const CLOSING_VERBS = 'erledigen|machen|liefern|fertigstellen|abschließen|erstellen|prüfen|klären|vorbereiten|schicken';

const fail = (error: string): ParseResult => ({ ok: false, error });

function stripArticle(text: string): string {
  return text.replace(/^(?:der|die|das|den|dem|ein|eine|einen|einem)\s+/i, '');
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeName(text: string): string {
  return stripArticle(text.trim()).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

type RecipientMatch = { ok: true; recipient: Recipient } | { ok: false; error: string };

function findRecipient(raw: string, recipients: Recipient[]): RecipientMatch {
  const wanted = normalizeName(raw);
  const shown = stripArticle(raw.trim());
  const matches = recipients.filter((r) => {
    const parts = r.name.split(' ');
    return [r.name, parts[0] ?? '', parts.at(-1) ?? ''].some((candidate) => normalizeName(candidate) === wanted);
  });
  if (matches.length === 1) return { ok: true, recipient: matches[0]! };
  if (matches.length > 1) {
    return { ok: false, error: `„${shown}“ ist nicht eindeutig: ${matches.map((r) => r.name).join(', ')}.` };
  }
  return { ok: false, error: `Ich kenne „${shown}“ nicht. Möglich sind: ${recipients.map((r) => r.name).join(', ')}.` };
}

/** Splits "Freitag – Kunde wartet" / "Freitag, Kontext: …" into deadline and context. */
function splitContext(tail: string): { deadline: string; context?: string } {
  const match = /^(.*?)(?:\s+[–—-]\s+|\s*[,;]\s*)(.+)$/.exec(tail);
  if (!match || match[1] === undefined || match[2] === undefined) return { deadline: tail.trim() };
  const context = match[2].replace(/^kontext:\s*/i, '').trim();
  return context ? { deadline: match[1].trim(), context } : { deadline: match[1].trim() };
}

export function parseDelegation(sentence: string, recipients: Recipient[], now: Date): ParseResult {
  const text = sentence.trim().replace(/\s+/g, ' ');
  if (!text) return fail(`Beschreibe die Aufgabe in einem Satz, z. B. ${EXAMPLE}.`);
  if (text.length > MAX_SENTENCE_LENGTH) return fail(`Der Satz ist zu lang (höchstens ${MAX_SENTENCE_LENGTH} Zeichen).`);

  let task: string | undefined;
  let who: string | undefined;
  let tail: string | undefined;

  const imperative = new RegExp(`^(?:bitte )?(?:${VERBS}) (.+) an (.+?)(?: bis (.+))?$`, 'i').exec(text);
  const shall = new RegExp(`^(.+?) soll (.+?)(?: bis (.+?))?(?: (?:${CLOSING_VERBS}))?$`, 'i').exec(text);
  if (imperative) {
    [, task, who, tail] = imperative;
  } else if (shall) {
    [, who, task, tail] = shall;
    if (tail) tail = tail.replace(new RegExp(` (?:${CLOSING_VERBS})(?=$|[,;]| [–—-] )`, 'i'), '');
  } else {
    return fail(`Ich erkenne Aufgabe und Empfänger nicht. Schreib z. B. ${EXAMPLE}.`);
  }
  if (!task || !who) return fail(`Ich erkenne Aufgabe und Empfänger nicht. Schreib z. B. ${EXAMPLE}.`);

  const recipient = findRecipient(who, recipients);
  if (!recipient.ok) return fail(recipient.error);

  if (!tail) return fail('Bis wann? Ergänze eine Frist, z. B. „bis Freitag“.');
  const { deadline, context } = splitContext(tail);
  const due = parseDeadline(deadline, now);
  if (!due) {
    return fail(`„${deadline}“ verstehe ich nicht als Frist. Beispiele: Freitag, morgen, 14.11., in 3 Tagen, KW 46.`);
  }
  if (parseDateOnly(due) < startOfDay(now)) return fail(`Die Frist ${deadline} liegt in der Vergangenheit.`);

  const draft: DelegationDraft = {
    title: capitalize(stripArticle(task.trim())),
    recipientId: recipient.recipient.id,
    due,
  };
  if (context) draft.context = context;
  return { ok: true, draft };
}
