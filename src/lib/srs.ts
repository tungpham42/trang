// A small spaced-repetition scheduler (SM-2 flavoured).
// Grades: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy.
export type Grade = 0 | 1 | 2 | 3;

export interface SrsState {
  ease: number;
  interval: number; // days
  reps: number;
}

export interface SrsResult extends SrsState {
  dueMs: number;
}

const DAY = 86_400_000;
const MIN_EASE = 1.3;

export function schedule(s: SrsState, grade: Grade, now: number = Date.now()): SrsResult {
  let { ease, interval, reps } = s;

  if (grade === 0) {
    reps = 0;
    interval = 0;
    ease = Math.max(MIN_EASE, ease - 0.2);
    return { ease, interval, reps, dueMs: now + 10 * 60_000 };
  }

  reps += 1;
  if (grade === 1) {
    ease = Math.max(MIN_EASE, ease - 0.15);
    interval = reps === 1 ? 1 : Math.max(1, Math.round(interval * 1.2));
  } else if (grade === 2) {
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease);
  } else {
    ease += 0.15;
    interval = reps === 1 ? 3 : reps === 2 ? 6 : Math.round(interval * ease * 1.3);
  }
  return { ease, interval, reps, dueMs: now + interval * DAY };
}

export function formatInterval(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months}mo` : `${(months / 12).toFixed(1)}y`;
}
