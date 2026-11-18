import { db } from '../db/schema';
import { getSettings } from '../hooks/useSettings';
import type { ContextInput } from './types';
import { addDaysISO } from '../domain/dates';

/** Загружает из IndexedDB всё, что нужно для контекста генерации. */
export async function loadContextInput(workoutId: string): Promise<ContextInput> {
  const workout = await db.workouts.get(workoutId);
  if (!workout) throw new Error('Тренировка не найдена');
  const settings = await getSettings();
  const from = addDaysISO(workout.date, -7 * Math.max(settings.historyWeeks, 2) - 14);
  const to = addDaysISO(workout.date, 21);
  const [cycleDays, workouts, exercises, bodyAll] = await Promise.all([
    db.cycleDays.toArray(),
    db.workouts.where('date').between(from, to, true, true).toArray(),
    db.exercises.toArray(),
    db.bodyEntries.orderBy('date').reverse().toArray(),
  ]);
  const ids = workouts.map((w) => w.id);
  const [workoutExercises, sets] = await Promise.all([
    db.workoutExercises.where('workoutId').anyOf(ids).toArray(),
    db.sets.where('date').between(from, workout.date, true, true).toArray(),
  ]);
  const body = bodyAll.find((b) => b.date <= workout.date && b.weight != null) ?? bodyAll.find((b) => b.weight != null) ?? null;
  return { workout, cycleDays, workouts, workoutExercises, sets, exercises, settings, body };
}
