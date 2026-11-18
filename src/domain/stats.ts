import type { Exercise, MuscleGroup, WorkSet } from './types';

export function isWorkingSet(s: Pick<WorkSet, 'isWarmup' | 'reps'>): boolean {
  return !s.isWarmup && s.reps > 0;
}

/** Расчётный 1ПМ по формуле Эпли. Для 1 повтора — сам вес. */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Тоннаж (вес × повторы) по рабочим подходам. */
export function tonnage(sets: WorkSet[]): number {
  return sets.filter(isWorkingSet).reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function groupBy<T, K extends string>(xs: T[], key: (x: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const x of xs) (out[key(x)] ??= []).push(x);
  return out;
}

export function tonnageByExercise(sets: WorkSet[]): Record<string, number> {
  const g = groupBy(sets, (s) => s.exerciseId);
  return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, tonnage(v)]));
}

export function tonnageByWorkout(sets: WorkSet[]): Record<string, number> {
  const g = groupBy(sets, (s) => s.workoutId);
  return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, tonnage(v)]));
}

export function tonnageByMuscle(sets: WorkSet[], exercises: Map<string, Exercise>): Partial<Record<MuscleGroup, number>> {
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const s of sets) {
    if (!isWorkingSet(s)) continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    out[ex.muscleGroup] = (out[ex.muscleGroup] ?? 0) + s.weight * s.reps;
  }
  return out;
}

/**
 * Рабочие подходы на группу мышц. Основная мышца упражнения получает 1 подход,
 * вспомогательные — `secondaryWeight` (по умолчанию 0, т.е. не учитываются).
 */
export function workingSetsByMuscle(
  sets: WorkSet[],
  exercises: Map<string, Exercise>,
  secondaryWeight = 0,
): Partial<Record<MuscleGroup, number>> {
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const s of sets) {
    if (!isWorkingSet(s)) continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    out[ex.muscleGroup] = (out[ex.muscleGroup] ?? 0) + 1;
    if (secondaryWeight > 0) for (const m of ex.secondary ?? []) out[m] = (out[m] ?? 0) + secondaryWeight;
  }
  return out;
}

export type VolumeZone = 'low' | 'ok' | 'high';
export const VOLUME_CORRIDOR: [number, number] = [10, 20];

export function volumeZone(sets: number, corridor = VOLUME_CORRIDOR): VolumeZone {
  if (sets < corridor[0]) return 'low';
  if (sets > corridor[1]) return 'high';
  return 'ok';
}

export interface ExerciseRecord {
  exerciseId: string;
  maxWeight: number;
  maxWeightReps: number;
  maxWeightDate: string;
  bestE1RM: number;
  bestE1RMDate: string;
  bestE1RMSet: { weight: number; reps: number };
  maxTonnageSession: number;
}

export function personalRecords(sets: WorkSet[]): Map<string, ExerciseRecord> {
  const out = new Map<string, ExerciseRecord>();
  const byEx = groupBy(sets.filter(isWorkingSet), (s) => s.exerciseId);
  for (const [exerciseId, list] of Object.entries(byEx)) {
    let rec: ExerciseRecord | null = null;
    for (const s of list) {
      const e = epley1RM(s.weight, s.reps);
      if (!rec) {
        rec = {
          exerciseId,
          maxWeight: s.weight,
          maxWeightReps: s.reps,
          maxWeightDate: s.date,
          bestE1RM: e,
          bestE1RMDate: s.date,
          bestE1RMSet: { weight: s.weight, reps: s.reps },
          maxTonnageSession: 0,
        };
        continue;
      }
      if (s.weight > rec.maxWeight || (s.weight === rec.maxWeight && s.reps > rec.maxWeightReps)) {
        rec.maxWeight = s.weight;
        rec.maxWeightReps = s.reps;
        rec.maxWeightDate = s.date;
      }
      if (e > rec.bestE1RM) {
        rec.bestE1RM = e;
        rec.bestE1RMDate = s.date;
        rec.bestE1RMSet = { weight: s.weight, reps: s.reps };
      }
    }
    if (rec) {
      const byW = tonnageByWorkout(list);
      rec.maxTonnageSession = Math.max(0, ...Object.values(byW));
      out.set(exerciseId, rec);
    }
  }
  return out;
}

export type RecordKind = 'weight' | 'e1rm';

/**
 * Проверяет, является ли новый подход рекордом относительно всех предыдущих
 * рабочих подходов этого упражнения. Первый в истории подход рекордом не считается.
 */
export function detectRecord(previous: WorkSet[], next: WorkSet): RecordKind[] {
  if (!isWorkingSet(next)) return [];
  const prev = previous.filter((s) => s.exerciseId === next.exerciseId && s.id !== next.id && isWorkingSet(s));
  if (prev.length === 0) return [];
  const kinds: RecordKind[] = [];
  const maxW = Math.max(...prev.map((s) => s.weight));
  const maxE = Math.max(...prev.map((s) => epley1RM(s.weight, s.reps)));
  if (next.weight > maxW) kinds.push('weight');
  if (epley1RM(next.weight, next.reps) > maxE + 1e-9) kinds.push('e1rm');
  return kinds;
}

/** Лучший расчётный 1ПМ по датам — для графика. */
export function e1rmSeries(sets: WorkSet[], exerciseId: string): { date: string; e1rm: number; weight: number; reps: number }[] {
  const byDate = groupBy(
    sets.filter((s) => s.exerciseId === exerciseId && isWorkingSet(s)),
    (s) => s.date,
  );
  return Object.entries(byDate)
    .map(([date, list]) => {
      const best = list.reduce((a, b) => (epley1RM(b.weight, b.reps) > epley1RM(a.weight, a.reps) ? b : a));
      return { date, e1rm: epley1RM(best.weight, best.reps), weight: best.weight, reps: best.reps };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
