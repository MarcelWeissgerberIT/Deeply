/**
 * React binding for the cockpit reducer. `apply` runs the reducer against the
 * latest state (also from timers) and returns an error message instead of
 * crashing the render when an action is invalid.
 */
import { useCallback, useRef, useState } from 'react';
import { cockpitReducer, type CockpitAction, type CockpitState } from './cockpit';

export function useCockpit(initial: () => CockpitState) {
  const [state, setState] = useState(initial);
  const latest = useRef(state);

  const apply = useCallback((action: CockpitAction): string | null => {
    try {
      const next = cockpitReducer(latest.current, action);
      latest.current = next;
      setState(next);
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Cockpit-Aktion abgelehnt:', action.type, message);
      return message;
    }
  }, []);

  return { state, apply };
}
