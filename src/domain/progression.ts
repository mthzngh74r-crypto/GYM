import { epley1RM, isWorkingSet } from './stats';
import type { WorkSet } from './types';

export interface Session {
  workoutId: string;
  date: string;
  sets: WorkSet[]; // только рабочие, по порядку
}

/** Сессии упражнения от новых к старым (по рабочим подходам). */
export function sessionsOf(sets: WorkSet[], exerciseId: string, excludeWorkoutId?: string): Session[] {
  const map = new Map<string, Session>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.workoutId === excludeWorkoutId || !isWorkingSet(s)) continue;
    const cur = map.get(s.workoutId) ?? { workoutId: s.workoutId, date: s.date, sets: [] };
    cur.sets.push(s);
    map.set(s.workoutId, cur);
  }
  return [...map.values()]
    .map((x) => ({ ...x, sets: x.sets.sort((a, b) => a.order - b.order) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function sessionBestE1RM(s: Session): number {
  return Math.max(0, ...s.sets.map((x) => epley1RM(x.weight, x.reps)));
}

/** Рабочий вес сессии — самый частый вес среди рабочих подходов (при равенстве — больший). */
export function sessionWorkingWeight(s: Session): number {
  const counts = new Map<number, number>();
  for (const x of s.sets) counts.set(x.weight, (counts.get(x.weight) ?? 0) + 1);
  let best = 0;
  let bestCount = -1;
  for (const [w, c] of counts) if (c > bestCount || (c === bestCount && w > best)) [best, bestCount] = [w, c];
  return best;
}

/** Двойная прогрессия: во всех рабочих подходах с рабочим весом достигнут верх диапазона. */
export function hitTopOfRange(s: Session, repMax: number): boolean {
  const w = sessionWorkingWeight(s);
  const atWeight = s.sets.filter((x) => x.weight >= w);
  return atWeight.length > 0 && atWeight.every((x) => x.reps >= repMax);
}

/**
 * Сколько последних тренировок подряд нет прогресса: не побит лучший e1RM
 * и не побит рекорд суммарных повторений с тем же рабочим весом.
 */
export function sessionsWithoutProgress(sessionsNewestFirst: Session[]): number {
  const chron = [...sessionsNewestFirst].reverse();
  let streak = 0;
  let bestE1RM = 0;
  const bestRepsAtWeight = new Map<number, number>();
  chron.forEach((s, i) => {
    const e = sessionBestE1RM(s);
    const w = sessionWorkingWeight(s);
    const reps = s.sets.filter((x) => x.weight >= w).reduce((a, x) => a + x.reps, 0);
    const prevReps = bestRepsAtWeight.get(w);
    const progressed = i === 0 || e > bestE1RM + 1e-9 || (prevReps !== undefined && reps > prevReps);
    streak = progressed ? 0 : streak + 1;
    bestE1RM = Math.max(bestE1RM, e);
    bestRepsAtWeight.set(w, Math.max(prevReps ?? 0, reps));
  });
  return streak;
}

export const STALL_THRESHOLD = 3;

export interface Recommendation {
  weightKg: number | null;
  reason: 'no_history' | 'increase' | 'keep' | 'stalled';
  stalledSessions: number;
}

/** Рекомендация рабочего веса на основе истории. */
export function recommendWeight(sessionsNewestFirst: Session[], repMax: number, stepKg: number): Recommendation {
  const last = sessionsNewestFirst[0];
  if (!last) return { weightKg: null, reason: 'no_history', stalledSessions: 0 };
  const stalled = sessionsWithoutProgress(sessionsNewestFirst);
  const w = sessionWorkingWeight(last);
  if (hitTopOfRange(last, repMax)) {
    return { weightKg: roundKg(w + stepKg, stepKg), reason: 'increase', stalledSessions: stalled };
  }
  if (stalled >= STALL_THRESHOLD) return { weightKg: w, reason: 'stalled', stalledSessions: stalled };
  return { weightKg: w, reason: 'keep', stalledSessions: stalled };
}

function roundKg(v: number, step: number): number {
  if (step <= 0) return v;
  return Math.round(Math.round(v / step) * step * 1000) / 1000;
}
