import { db } from './schema';
import { uid } from '../domain/id';
import type { CycleDay, Workout, WorkoutExercise, WorkSet } from '../domain/types';
import { planSequence } from '../domain/cycle';

// ---------- Расписание ----------

export async function planWorkout(date: string, day: CycleDay): Promise<string> {
  const w: Workout = {
    id: uid(),
    date,
    cycleDayId: day.id,
    cycleDayOrder: day.order,
    cycleDayName: day.name,
    isRest: day.isRest,
    status: 'planned',
    notes: '',
  };
  await db.workouts.add(w);
  return w.id;
}

export async function planMany(dates: string[]): Promise<number> {
  const [days, workouts] = await Promise.all([db.cycleDays.toArray(), db.workouts.toArray()]);
  const plan = planSequence(days, workouts, dates);
  for (const p of plan) await planWorkout(p.date, p.day);
  return plan.length;
}

/** Сменить день цикла у запланированной тренировки (подобранные упражнения сбрасываются). */
export async function changeWorkoutDay(id: string, day: CycleDay): Promise<void> {
  await db.transaction('rw', db.workouts, db.workoutExercises, db.sets, async () => {
    await clearExercises(id);
    await db.workouts.update(id, {
      cycleDayId: day.id,
      cycleDayOrder: day.order,
      cycleDayName: day.name,
      isRest: day.isRest,
      generation: undefined,
    });
  });
}

export async function moveWorkout(id: string, date: string): Promise<void> {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.workouts.update(id, { date });
    await db.sets.where('workoutId').equals(id).modify({ date });
  });
}

export async function setWorkoutStatus(id: string, status: Workout['status']): Promise<void> {
  const patch: Partial<Workout> = { status };
  if (status === 'in_progress') patch.startedAt = Date.now();
  if (status === 'done') patch.finishedAt = Date.now();
  await db.workouts.update(id, patch);
}

export async function startWorkout(id: string): Promise<void> {
  const w = await db.workouts.get(id);
  if (!w || w.status === 'in_progress') return;
  await db.workouts.update(id, { status: 'in_progress', startedAt: w.startedAt ?? Date.now() });
}

export async function deleteWorkout(id: string): Promise<void> {
  await db.transaction('rw', db.workouts, db.workoutExercises, db.sets, async () => {
    await clearExercises(id);
    await db.workouts.delete(id);
  });
}

async function clearExercises(workoutId: string) {
  await db.sets.where('workoutId').equals(workoutId).delete();
  await db.workoutExercises.where('workoutId').equals(workoutId).delete();
}

// ---------- Упражнения тренировки ----------

export async function getWorkoutExercises(workoutId: string): Promise<WorkoutExercise[]> {
  const list = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
  return list.sort((a, b) => a.order - b.order);
}

/** Заменить план упражнений, сохранив уже введённые подходы для тех же упражнений. */
export async function replaceWorkoutExercises(
  workoutId: string,
  items: Omit<WorkoutExercise, 'id' | 'workoutId'>[],
): Promise<void> {
  await db.transaction('rw', db.workoutExercises, db.sets, async () => {
    const old = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    const sets = await db.sets.where('workoutId').equals(workoutId).toArray();
    const withSets = new Set(sets.map((s) => s.workoutExerciseId));
    const keep = old.filter((o) => withSets.has(o.id));
    const keepByExercise = new Map(keep.map((k) => [k.exerciseId, k]));
    const usedKeep = new Set<string>();
    const next: WorkoutExercise[] = items.map((it) => {
      const existing = keepByExercise.get(it.exerciseId);
      if (existing && !usedKeep.has(existing.id)) {
        usedKeep.add(existing.id);
        return { ...existing, ...it, notes: existing.notes || it.notes, id: existing.id, workoutId };
      }
      return { ...it, id: uid(), workoutId };
    });
    // упражнения с подходами, не попавшие в новый план, оставляем в конце
    let order = next.length;
    for (const k of keep) if (!usedKeep.has(k.id)) next.push({ ...k, order: order++ });
    await db.workoutExercises.where('workoutId').equals(workoutId).delete();
    await db.workoutExercises.bulkAdd(next);
  });
}

export async function updateWorkoutExercise(id: string, patch: Partial<WorkoutExercise>): Promise<void> {
  await db.workoutExercises.update(id, patch);
}

export async function addWorkoutExercise(item: Omit<WorkoutExercise, 'id'>): Promise<string> {
  const id = uid();
  await db.workoutExercises.add({ ...item, id });
  return id;
}

export async function removeWorkoutExercise(id: string): Promise<void> {
  await db.transaction('rw', db.workoutExercises, db.sets, async () => {
    await db.sets.where('workoutExerciseId').equals(id).delete();
    await db.workoutExercises.delete(id);
  });
}

/** Заменить упражнение в слоте. Подходы, если были, сохраняются под новым упражнением. */
export async function swapExercise(weId: string, exerciseId: string, patch: Partial<WorkoutExercise> = {}): Promise<void> {
  await db.transaction('rw', db.workoutExercises, db.sets, async () => {
    await db.workoutExercises.update(weId, { ...patch, exerciseId });
    await db.sets.where('workoutExerciseId').equals(weId).modify({ exerciseId });
  });
}

// ---------- Подходы ----------

export async function addSet(s: Omit<WorkSet, 'id' | 'createdAt'>): Promise<WorkSet> {
  const set: WorkSet = { ...s, id: uid(), createdAt: Date.now() };
  await db.sets.add(set);
  return set;
}

export async function updateSet(id: string, patch: Partial<WorkSet>): Promise<void> {
  await db.sets.update(id, patch);
}

export async function deleteSet(id: string): Promise<void> {
  await db.sets.delete(id);
}

// ---------- Шаблон ----------

export async function saveCycleDay(day: CycleDay): Promise<void> {
  await db.cycleDays.put(day);
}

export async function deleteCycleDay(id: string): Promise<void> {
  await db.transaction('rw', db.cycleDays, async () => {
    await db.cycleDays.delete(id);
    const rest = (await db.cycleDays.toArray()).sort((a, b) => a.order - b.order);
    await db.cycleDays.bulkPut(rest.map((d, i) => ({ ...d, order: i + 1 })));
  });
}

export async function moveCycleDay(id: string, dir: -1 | 1): Promise<void> {
  await db.transaction('rw', db.cycleDays, async () => {
    const days = (await db.cycleDays.toArray()).sort((a, b) => a.order - b.order);
    const i = days.findIndex((d) => d.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= days.length) return;
    [days[i], days[j]] = [days[j], days[i]];
    await db.cycleDays.bulkPut(days.map((d, k) => ({ ...d, order: k + 1 })));
  });
}
