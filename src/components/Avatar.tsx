/** Recipient avatar: round for people, hexagonal for agents, same size and weight. */
import type { Recipient } from '../domain/types';

function initials(r: Recipient): string {
  if (r.kind === 'person') {
    return r.name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  const word = r.name.split('-')[0] ?? r.name;
  const consonant = word.slice(1).match(/[bcdfghjklmnpqrstvwxz]/i)?.[0] ?? word.charAt(1);
  return (word.charAt(0) + consonant).toUpperCase();
}

export function Avatar({ recipient, size = 'md' }: { recipient: Recipient; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`avatar avatar--${recipient.kind} avatar--${size}`} aria-hidden="true">
      {initials(recipient)}
    </span>
  );
}
