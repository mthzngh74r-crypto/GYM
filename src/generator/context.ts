import { addDaysISO, diffDays } from '../domain/dates';
import { musclesOfSlotGroup, slotMatchesMuscle } from '../domain/muscles';
import { recommendWeight, sessionsOf } from '../domain/progression';
import { stepInKg } from '../domain/units';
import type { CycleDay, Exercise, MuscleGroup, Settings, Slot, Workout, WorkoutExercise } from '../domain/types';
import { bmi } from '../domain/body';
import type { ContextInput, ExerciseHistory, GenerationContext, MuscleRecovery, NeighborWorkout, SlotContext } from './types';

/** Доступно ли упражнение с текущим оборудованием и ограничениями. */
export function isAvailable(ex: Exercise, settings: Pick<Settings, 'equipment' | 'limitations'>): boolean {
  if (ex.archived) return false;
  const eqOk = ex.equipment.every((e) => e === 'bodyweight' || settings.equipment.includes(e));
  if (!eqOk) return false;
  return !mentionedInLimitations(ex.name, settings.limitations);
}

/** Грубая эвристика: упражнение явно упомянуто в ограничениях («без жима из-за головы» и т.п.). */
export function mentionedInLimitations(name: string, limitations: string): boolean {
  const lim = limitations.toLowerCase();
  if (!lim.trim()) return false;
  return lim.includes(name.toLowerCase());
}

export function slotCandidates(slot: Slot, exercises: Exercise[], settings: Pick<Settings, 'equipment' | 'limitations'>): Exercise[] {
  return exercises.filter(
    (e) =>
      slotMatchesMuscle(slot.muscleGroup, e.muscleGroup) &&
      (slot.kind === 'any' || slot.kind === e.kind) &&
      isAvailable(e, settings),
  );
}

export function resolveCycleDay(w: Workout, days: CycleDay[]): CycleDay | undefined {
  return days.find((d) => d.id === w.cycleDayId) ?? days.find((d) => d.order === w.cycleDayOrder);
}

/** Мышцы, которые нагружает тренировка: по фактическим упражнениям, иначе по шаблону. */
export function workoutMuscles(
  w: Workout,
  days: CycleDay[],
  wesByWorkout: Map<string, WorkoutExercise[]>,
  exById: Map<string, Exercise>,
): MuscleGroup[] {
  const wes = wesByWorkout.get(w.id) ?? [];
  const set = new Set<MuscleGroup>();
  if (wes.length) {
    for (const we of wes) {
      const ex = exById.get(we.exerciseId);
      if (ex) set.add(ex.muscleGroup);
    }
  } else {
    const day = resolveCycleDay(w, days);
    for (const s of day?.slots ?? []) for (const m of musclesOfSlotGroup(s.muscleGroup)) set.add(m);
  }
  return [...set];
}

export function buildContext(input: ContextInput): GenerationContext {
  const { workout, cycleDays, settings } = input;
  const date = workout.date;
  const day = resolveCycleDay(workout, cycleDays);
  const slots = day?.slots ?? [];
  const exById = new Map(input.exercises.map((e) => [e.id, e]));
  const wesByWorkout = new Map<string, WorkoutExercise[]>();
  for (const we of input.workoutExercises) {
    const arr = wesByWorkout.get(we.workoutId) ?? [];
    arr.push(we);
    wesByWorkout.set(we.workoutId, arr);
  }
  const stepKg = stepInKg(settings.weightStep, settings.units);
  const others = input.workouts.filter((w) => w.id !== workout.id && w.status !== 'skipped' && !w.isRest);
  const byDateAsc = (a: Workout, b: Workout) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  // --- соседние тренировки
  const toNeighbor = (w: Workout): NeighborWorkout => ({
    date: w.date,
    dayOrder: w.cycleDayOrder,
    name: w.cycleDayName,
    muscles: workoutMuscles(w, cycleDays, wesByWorkout, exById),
    status: w.status,
  });
  const pastLoaded = others
    .filter((w) => w.date < date && (w.status === 'done' || w.status === 'in_progress'))
    .sort(byDateAsc);
  const previous = pastLoaded.slice(-3).map(toNeighbor);
  const upcoming = others
    .filter((w) => w.date > date && w.status === 'planned' && diffDays(date, w.date) <= 7)
    .sort(byDateAsc)
    .map(toNeighbor);

  // --- восстановление мышц
  const slotMuscles = [...new Set(slots.flatMap((s) => musclesOfSlotGroup(s.muscleGroup)))];
  const recovery: MuscleRecovery[] = slotMuscles.map((muscle) => {
    const last = [...pastLoaded].reverse().find((w) => workoutMuscles(w, cycleDays, wesByWorkout, exById).includes(muscle));
    const hoursSince = last ? diffDays(last.date, date) * 24 : null;
    return { muscle, lastDate: last?.date ?? null, hoursSince, under48h: hoursSince !== null && hoursSince < 48 };
  });

  // --- прошлый раз в этом же дне цикла
  const sameDayPrev = others
    .filter((w) => w.date < date && day && w.cycleDayId === day.id && (wesByWorkout.get(w.id)?.length ?? 0) > 0)
    .sort(byDateAsc)
    .at(-1);
  const sameDayWes = sameDayPrev ? wesByWorkout.get(sameDayPrev.id) ?? [] : [];

  // --- другие дни текущего цикла (окно ± длина цикла)
  const cycleLen = Math.max(cycleDays.length, 1);
  const from = addDaysISO(date, -cycleLen);
  const to = addDaysISO(date, cycleLen);
  const otherDayWes = others
    .filter((w) => w.date >= from && w.date <= to && w.cycleDayId !== day?.id)
    .flatMap((w) => wesByWorkout.get(w.id) ?? []);

  const slotCtx: SlotContext[] = slots.map((slot) => {
    const muscles = musclesOfSlotGroup(slot.muscleGroup);
    const matches = (id: string) => {
      const ex = exById.get(id);
      return !!ex && slotMatchesMuscle(slot.muscleGroup, ex.muscleGroup) && (slot.kind === 'any' || ex.kind === slot.kind);
    };
    let lastTime = sameDayWes.filter((we) => we.slotId === slot.id).map((we) => we.exerciseId);
    if (lastTime.length === 0) lastTime = sameDayWes.map((we) => we.exerciseId).filter(matches);
    const usedInOtherDays = [...new Set(otherDayWes.map((we) => we.exerciseId).filter((id) => {
      const ex = exById.get(id);
      return !!ex && slotMatchesMuscle(slot.muscleGroup, ex.muscleGroup);
    }))];
    return {
      slot,
      muscles,
      lastTimeInThisDay: [...new Set(lastTime)],
      usedInOtherDays,
      candidates: slotCandidates(slot, input.exercises, settings).map((e) => e.id),
    };
  });

  // --- история
  const histFrom = addDaysISO(date, -7 * settings.historyWeeks);
  const histSets = input.sets.filter((s) => s.date >= histFrom && s.date < date && s.workoutId !== workout.id);
  const relevantIds = new Set<string>();
  for (const s of histSets) {
    const ex = exById.get(s.exerciseId);
    if (ex && slotMuscles.includes(ex.muscleGroup)) relevantIds.add(ex.id);
  }
  for (const sc of slotCtx) for (const id of [...sc.lastTimeInThisDay, ...sc.usedInOtherDays]) relevantIds.add(id);
  const weById = new Map(input.workoutExercises.map((we) => [we.id, we]));
  const history: ExerciseHistory[] = [];
  for (const id of relevantIds) {
    const ex = exById.get(id);
    if (!ex) continue;
    const sessions = sessionsOf(histSets, id);
    if (sessions.length === 0) continue;
    const lastWe = weById.get(sessions[0].sets[0].workoutExerciseId);
    const defaultRange = ex.kind === 'compound' ? settings.repRanges.compound : settings.repRanges.isolation;
    const repMax = lastWe?.repMax ?? defaultRange[1];
    history.push({
      exerciseId: id,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      kind: ex.kind,
      repMaxUsed: repMax,
      recommendation: recommendWeight(sessions, repMax, stepKg),
      sessions: sessions.slice(0, 4).map((s) => ({
        date: s.date,
        sets: s.sets.map((x) => ({ weight: x.weight, reps: x.reps, rpe: x.rpe ?? null })),
        notes: weById.get(s.sets[0].workoutExerciseId)?.notes ?? '',
      })),
    });
  }

  const body = input.body;
  return {
    date,
    dayOrder: day?.order ?? workout.cycleDayOrder,
    dayName: day?.name ?? workout.cycleDayName,
    slots: slotCtx,
    goal: settings.goal,
    equipment: settings.equipment,
    limitations: settings.limitations,
    repRanges: settings.repRanges,
    restSec: settings.restSec,
    stepKg,
    units: settings.units,
    body: {
      heightCm: settings.heightCm,
      weightKg: body?.weight ?? null,
      bodyFatPct: body?.bodyFat ?? null,
      bmi: bmi(body?.weight ?? null, settings.heightCm),
      date: body?.date ?? null,
    },
    recovery,
    previous,
    upcoming,
    history,
  };
}
