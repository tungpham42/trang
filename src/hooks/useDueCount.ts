import { useEffect, useState } from 'react';
import { subscribeDueCount } from '../lib/db';

/** Number of flashcards due right now (capped at 100). Re-evaluated every few minutes. */
export function useDueCount(uid?: string): number {
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 5 * 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }
    return subscribeDueCount(uid, setCount);
  }, [uid, tick]);

  return count;
}
