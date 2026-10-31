/** Ampel state as a chip: colored dot plus the reason in words. */
import type { Assessment } from '../domain/types';
import { LIGHT_LABEL } from '../domain/labels';

export function LightChip({ assessment }: { assessment: Assessment }) {
  return (
    <span className={`chip chip--${assessment.light}`}>
      <span className="chip__dot" aria-hidden="true" />
      <span className="sr-only">{LIGHT_LABEL[assessment.light]}: </span>
      {assessment.reason}
    </span>
  );
}
