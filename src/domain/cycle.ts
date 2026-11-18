import type { CycleDay, Workout } from './types';

export function sortDays(days: CycleDay[]): CycleDay[] {
  return [...days].sort((a, b) => a.order - b.order);
}

export function sortWorkouts(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Текущий порядковый индекс дня тренировки в шаблоне (если день удалён — по снимку). */
function indexInTemplate(days: CycleDay[], w: Workout): number {
  const sorted = sortDays(days);
  const byId = sorted.findIndex((d) => d.id === w.cycleDayId);
  if (byId >= 0) return byId;
  const byOrder = sorted.findIndex((d) => d.order === w.cycleDayOrder);
  return byOrder >= 0 ? byOrder : -1;
}

/**
 * День цикла, который логично поставить на дату `date`.
 * Берём последнюю тренировку строго до этой даты, которая не пропущена,
 * и предлагаем следующий за ней день. Пропущенные не двигают цикл,
 * поэтому пропущенный день снова становится следующим.
 */
export function nextCycleDay(
  days: CycleDay[],
  workouts: Workout[],
  date: string,
  excludeWorkoutId?: string,
): CycleDay | undefined {
  const sorted = sortDays(days);
  if (sorted.length === 0) return undefined;
  const before = sortWorkouts(
    workouts.filter((w) => w.id !== excludeWorkoutId && w.status !== 'skipped' && w.date < date),
  );
  // если на одну дату несколько записей — берём ту, что дальше по циклу не угадать; берём последнюю в массиве
  const last = before[before.length - 1];
  if (!last) return sorted[0];
  const idx = indexInTemplate(sorted, last);
  if (idx < 0) return sorted[0];
  return sorted[(idx + 1) % sorted.length];
}

/**
 * Последовательно расставляет дни цикла на выбранные даты
 * (используется для «распланировать вперёд»).
 */
export function planSequence(
  days: CycleDay[],
  workouts: Workout[],
  dates: string[],
): { date: string; day: CycleDay }[] {
  const sorted = sortDays(days);
  if (sorted.length === 0) return [];
  const sortedDates = [...dates].sort();
  const result: { date: string; day: CycleDay }[] = [];
  const virtual: Workout[] = [...workouts];
  for (const date of sortedDates) {
    const day = nextCycleDay(sorted, virtual, date);
    if (!day) continue;
    result.push({ date, day });
    virtual.push(makeVirtualWorkout(day, date));
  }
  return result;
}

function makeVirtualWorkout(day: CycleDay, date: string): Workout {
  return {
    id: `virtual-${date}-${day.id}`,
    date,
    cycleDayId: day.id,
    cycleDayOrder: day.order,
    cycleDayName: day.name,
    isRest: day.isRest,
    status: 'planned',
    notes: '',
  };
}

/**
 * Число завершённых циклов: сколько раз тренировочные дни шаблона
 * были выполнены по порядку от первого до последнего.
 * Дни отдыха не обязательны: их можно не ставить в календарь.
 */
export function completedCycles(days: CycleDay[], workouts: Workout[]): number {
  const trainingDays = sortDays(days).filter((d) => !d.isRest);
  if (trainingDays.length === 0) return 0;
  const done = sortWorkouts(workouts.filter((w) => w.status === 'done' && !w.isRest));
  let cycles = 0;
  let expected = 0; // индекс ожидаемого дня в trainingDays
  let clean = false; // текущий проход начат с первого дня и идёт без сбоев
  for (const w of done) {
    let idx = trainingDays.findIndex((d) => d.id === w.cycleDayId);
    if (idx < 0) idx = trainingDays.findIndex((d) => d.order === w.cycleDayOrder);
    if (idx < 0) continue;
    if (idx === 0) {
      clean = true;
      expected = 1;
    } else if (idx === expected && clean) {
      expected++;
    } else {
      clean = false;
      expected = idx + 1;
    }
    if (clean && expected === trainingDays.length) {
      cycles++;
      clean = false;
      expected = 0;
    }
  }
  return cycles;
}

/** Дата начала текущего цикла: последний выполненный первый тренировочный день не позже `today`. */
export function currentCycleStart(days: CycleDay[], workouts: Workout[], today: string): string | null {
  const first = sortDays(days).find((d) => !d.isRest);
  if (!first) return null;
  const starts = workouts
    .filter((w) => (w.cycleDayId === first.id || w.cycleDayOrder === first.order) && w.date <= today && (w.status === 'done' || w.status === 'in_progress'))
    .map((w) => w.date)
    .sort();
  return starts.at(-1) ?? null;
}
