import type { Workout } from './types';

export type DisplayStatus = 'done' | 'planned' | 'skipped' | 'overdue' | 'in_progress' | 'rest';

/** Статус для отображения с учётом сегодняшней даты. */
export function displayStatus(w: Workout, today: string): DisplayStatus {
  if (w.status === 'skipped') return 'skipped';
  if (w.isRest) return w.status === 'done' || w.date < today ? 'done' : 'rest';
  if (w.status === 'done') return 'done';
  if (w.status === 'in_progress') return w.date < today ? 'overdue' : 'in_progress';
  return w.date < today ? 'overdue' : 'planned';
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  done: 'Выполнена',
  planned: 'Запланирована',
  skipped: 'Пропущена',
  overdue: 'Просрочена',
  in_progress: 'В процессе',
  rest: 'Отдых',
};

/** Ближайшая актуальная тренировка: сегодняшняя, начатая или первая будущая. */
export function pickCurrentWorkout(workouts: Workout[], today: string): Workout | undefined {
  const active = workouts.filter((w) => w.status === 'in_progress');
  if (active.length) return active.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const todays = workouts.filter((w) => w.date === today && w.status !== 'skipped');
  const todayOpen = todays.find((w) => w.status === 'planned');
  if (todayOpen) return todayOpen;
  if (todays.length) return todays[0];
  return workouts
    .filter((w) => w.date > today && w.status === 'planned')
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
}

/** Просроченные тренировки: дата прошла, а тренировка не выполнена и не пропущена. */
export function overdueWorkouts(workouts: Workout[], today: string): Workout[] {
  return workouts
    .filter((w) => !w.isRest && w.date < today && (w.status === 'planned' || w.status === 'in_progress'))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
