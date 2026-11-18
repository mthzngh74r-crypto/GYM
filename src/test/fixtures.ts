import { SEED_CYCLE } from '../db/seed/template';
import { SEED_EXERCISES } from '../db/seed/exercises';
import { DEFAULT_SETTINGS } from '../db/defaults';
import type { ContextInput } from '../generator/types';
import type { Settings, Workout, WorkoutExercise, WorkSet } from '../domain/types';

let n = 0;
const id = (p: string) => `${p}${++n}`;

export function makeWorkout(date: string, order: number, status: Workout['status'] = 'done'): Workout {
  const day = SEED_CYCLE.find((d) => d.order === order)!;
  return { id: id('w'), date, cycleDayId: day.id, cycleDayOrder: order, cycleDayName: day.name, isRest: day.isRest, status, notes: '' };
}

/** Тренировка с упражнениями и подходами: [exerciseId, slotId, [[вес, повторы], ...]] */
export function logWorkout(
  w: Workout,
  items: [string, string, [number, number][], number?][],
): { wes: WorkoutExercise[]; sets: WorkSet[] } {
  const wes: WorkoutExercise[] = [];
  const sets: WorkSet[] = [];
  items.forEach(([exerciseId, slotId, ss, repMax], i) => {
    const we: WorkoutExercise = {
      id: id('we'),
      workoutId: w.id,
      slotId,
      order: i,
      exerciseId,
      targetSets: ss.length,
      repMin: 6,
      repMax: repMax ?? 10,
      restSec: 120,
      aiNote: '',
      notes: '',
    };
    wes.push(we);
    ss.forEach(([weight, reps], k) =>
      sets.push({
        id: id('s'),
        workoutExerciseId: we.id,
        workoutId: w.id,
        exerciseId,
        date: w.date,
        order: k + 1,
        weight,
        reps,
        isWarmup: false,
        createdAt: 0,
      }),
    );
  });
  return { wes, sets };
}

export function makeInput(
  workout: Workout,
  past: { w: Workout; wes: WorkoutExercise[]; sets: WorkSet[] }[] = [],
  settings: Partial<Settings> = {},
  extraWorkouts: Workout[] = [],
): ContextInput {
  return {
    workout,
    cycleDays: SEED_CYCLE,
    workouts: [workout, ...past.map((p) => p.w), ...extraWorkouts],
    workoutExercises: past.flatMap((p) => p.wes),
    sets: past.flatMap((p) => p.sets),
    exercises: SEED_EXERCISES,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    body: null,
  };
}
