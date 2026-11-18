import { describe, expect, it } from 'vitest';
import { completedCycles, nextCycleDay, planSequence } from './cycle';
import { SEED_CYCLE } from '../db/seed/template';
import type { Workout, WorkoutStatus } from './types';
import { displayStatus, overdueWorkouts, pickCurrentWorkout } from './schedule';

function w(date: string, order: number, status: WorkoutStatus = 'done', id = `${date}-${order}`): Workout {
  const day = SEED_CYCLE.find((d) => d.order === order)!;
  return {
    id,
    date,
    cycleDayId: day.id,
    cycleDayOrder: order,
    cycleDayName: day.name,
    isRest: day.isRest,
    status,
    notes: '',
  };
}

describe('nextCycleDay', () => {
  it('без истории предлагает день 1', () => {
    expect(nextCycleDay(SEED_CYCLE, [], '2026-01-01')?.order).toBe(1);
  });

  it('предлагает следующий день после последней тренировки', () => {
    const ws = [w('2026-01-01', 1), w('2026-01-02', 2)];
    expect(nextCycleDay(SEED_CYCLE, ws, '2026-01-04')?.order).toBe(3);
  });

  it('после дня 6 снова день 1', () => {
    expect(nextCycleDay(SEED_CYCLE, [w('2026-01-06', 6)], '2026-01-07')?.order).toBe(1);
  });

  it('пропуск не сбивает цикл: пропущенный день снова следующий', () => {
    const ws = [w('2026-01-01', 1), w('2026-01-02', 2, 'skipped')];
    expect(nextCycleDay(SEED_CYCLE, ws, '2026-01-03')?.order).toBe(2);
  });

  it('учитывает запланированные тренировки до даты', () => {
    const ws = [w('2026-01-01', 1), w('2026-01-03', 2, 'planned')];
    expect(nextCycleDay(SEED_CYCLE, ws, '2026-01-05')?.order).toBe(3);
  });

  it('не учитывает тренировки на ту же дату и позже', () => {
    const ws = [w('2026-01-01', 1), w('2026-01-05', 2, 'planned'), w('2026-01-09', 3, 'planned')];
    expect(nextCycleDay(SEED_CYCLE, ws, '2026-01-05')?.order).toBe(2);
  });

  it('можно исключить переносимую тренировку', () => {
    const ws = [w('2026-01-01', 1), w('2026-01-02', 2, 'planned', 'move-me')];
    expect(nextCycleDay(SEED_CYCLE, ws, '2026-01-04', 'move-me')?.order).toBe(2);
  });

  it('работает, если день удалён из шаблона (по снимку порядка)', () => {
    const ws: Workout[] = [{ ...w('2026-01-01', 2), cycleDayId: 'deleted' }];
    expect(nextCycleDay(SEED_CYCLE, ws, '2026-01-02')?.order).toBe(3);
  });
});

describe('planSequence', () => {
  it('расставляет дни по порядку на выбранные даты', () => {
    const plan = planSequence(SEED_CYCLE, [w('2026-01-01', 5)], ['2026-01-05', '2026-01-03', '2026-01-04']);
    expect(plan.map((p) => [p.date, p.day.order])).toEqual([
      ['2026-01-03', 6],
      ['2026-01-04', 1],
      ['2026-01-05', 2],
    ]);
  });
});

describe('completedCycles', () => {
  it('считает полный проход тренировочных дней (отдых не обязателен)', () => {
    const ws = [1, 2, 3, 5, 6].map((o, i) => w(`2026-01-0${i + 1}`, o));
    expect(completedCycles(SEED_CYCLE, ws)).toBe(1);
  });

  it('незавершённый цикл не считается', () => {
    const ws = [1, 2, 3, 5].map((o, i) => w(`2026-01-0${i + 1}`, o));
    expect(completedCycles(SEED_CYCLE, ws)).toBe(0);
  });

  it('пропущенные тренировки не мешают, два цикла подряд', () => {
    const orders = [1, 2, 3, 5, 6, 1, 2, 3, 5, 6];
    const ws = orders.map((o, i) => w(`2026-02-${String(i + 1).padStart(2, '0')}`, o));
    ws.splice(3, 0, w('2026-02-03', 4, 'done', 'rest'));
    ws.push(w('2026-02-28', 1, 'skipped'));
    expect(completedCycles(SEED_CYCLE, ws)).toBe(2);
  });

  it('нарушенный порядок не засчитывается', () => {
    const ws = [1, 3, 2, 5, 6].map((o, i) => w(`2026-01-0${i + 1}`, o));
    expect(completedCycles(SEED_CYCLE, ws)).toBe(0);
  });
});

describe('schedule', () => {
  it('просроченная тренировка', () => {
    expect(displayStatus(w('2026-01-01', 1, 'planned'), '2026-01-02')).toBe('overdue');
    expect(displayStatus(w('2026-01-03', 1, 'planned'), '2026-01-02')).toBe('planned');
    expect(displayStatus(w('2026-01-01', 4, 'planned'), '2026-01-02')).toBe('done');
    expect(overdueWorkouts([w('2026-01-01', 1, 'planned'), w('2026-01-01', 4, 'planned')], '2026-01-02')).toHaveLength(1);
  });

  it('текущая тренировка: начатая важнее сегодняшней', () => {
    const ws = [w('2026-01-02', 2, 'planned'), w('2026-01-01', 1, 'in_progress')];
    expect(pickCurrentWorkout(ws, '2026-01-02')?.cycleDayOrder).toBe(1);
    expect(pickCurrentWorkout([w('2026-01-05', 3, 'planned')], '2026-01-02')?.cycleDayOrder).toBe(3);
  });
});
