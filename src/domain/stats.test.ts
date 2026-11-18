import { describe, expect, it } from 'vitest';
import {
  detectRecord,
  e1rmSeries,
  epley1RM,
  personalRecords,
  tonnage,
  tonnageByExercise,
  tonnageByMuscle,
  volumeZone,
  workingSetsByMuscle,
} from './stats';
import type { WorkSet } from './types';
import { SEED_EXERCISES } from '../db/seed/exercises';

const exById = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
let k = 0;
function s(exerciseId: string, weight: number, reps: number, opts: Partial<WorkSet> = {}): WorkSet {
  k++;
  return { id: `s${k}`, workoutExerciseId: 'we', workoutId: 'w1', exerciseId, date: '2026-01-01', order: k, weight, reps, isWarmup: false, createdAt: k, ...opts };
}

describe('1ПМ (Эпли)', () => {
  it('считает по формуле w × (1 + r/30)', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 2);
    expect(epley1RM(80, 5)).toBeCloseTo(93.33, 2);
  });
  it('для 1 повтора возвращает вес, для нуля — 0', () => {
    expect(epley1RM(150, 1)).toBe(150);
    expect(epley1RM(0, 10)).toBe(0);
    expect(epley1RM(100, 0)).toBe(0);
  });
  it('серия по датам берёт лучший подход дня', () => {
    const series = e1rmSeries(
      [s('bench_press', 80, 8), s('bench_press', 85, 5), s('bench_press', 90, 3, { date: '2026-01-05' })],
      'bench_press',
    );
    expect(series).toHaveLength(2);
    expect(series[0].e1rm).toBeCloseTo(epley1RM(80, 8));
    expect(series[1].date).toBe('2026-01-05');
  });
});

describe('тоннаж', () => {
  it('сумма вес × повторы без разминочных', () => {
    const sets = [s('bench_press', 100, 5), s('bench_press', 100, 5), s('bench_press', 40, 10, { isWarmup: true })];
    expect(tonnage(sets)).toBe(1000);
  });
  it('по упражнениям и мышцам', () => {
    const sets = [s('bench_press', 100, 5), s('db_fly', 20, 10), s('barbell_curl', 30, 10)];
    expect(tonnageByExercise(sets)).toEqual({ bench_press: 500, db_fly: 200, barbell_curl: 300 });
    expect(tonnageByMuscle(sets, exById)).toEqual({ chest: 700, biceps: 300 });
  });
});

describe('объём по мышцам', () => {
  it('считает рабочие подходы по основной мышце', () => {
    const sets = [s('bench_press', 100, 5), s('bench_press', 100, 5), s('pullups', 0, 10), s('db_fly', 20, 10, { isWarmup: true })];
    // подтягивания с весом 0 (свой вес) тоже рабочий подход
    expect(workingSetsByMuscle(sets, exById)).toEqual({ chest: 2, back: 1 });
  });
  it('может учитывать вспомогательные мышцы с коэффициентом', () => {
    expect(workingSetsByMuscle([s('bench_press', 100, 5)], exById, 0.5)).toEqual({ chest: 1, triceps: 0.5, shoulders: 0.5 });
  });
  it('коридор 10–20', () => {
    expect(volumeZone(9)).toBe('low');
    expect(volumeZone(10)).toBe('ok');
    expect(volumeZone(20)).toBe('ok');
    expect(volumeZone(21)).toBe('high');
  });
});

describe('рекорды', () => {
  it('личные рекорды по упражнению', () => {
    const r = personalRecords([s('bench_press', 100, 5), s('bench_press', 110, 1), s('bench_press', 90, 10)]).get('bench_press')!;
    expect(r.maxWeight).toBe(110);
    expect(r.bestE1RM).toBeCloseTo(120); // 90 × (1 + 10/30)
    expect(r.bestE1RMSet).toEqual({ weight: 90, reps: 10 });
  });
  it('новый рекорд по весу и по 1ПМ', () => {
    const prev = [s('bench_press', 100, 5)];
    expect(detectRecord(prev, s('bench_press', 102.5, 3))).toEqual(['weight']);
    expect(detectRecord(prev, s('bench_press', 100, 6))).toEqual(['e1rm']);
    expect(detectRecord(prev, s('bench_press', 105, 5))).toEqual(['weight', 'e1rm']);
    expect(detectRecord(prev, s('bench_press', 95, 5))).toEqual([]);
  });
  it('первый подход в истории и разминка — не рекорд', () => {
    expect(detectRecord([], s('bench_press', 100, 5))).toEqual([]);
    expect(detectRecord([s('bench_press', 100, 5)], s('bench_press', 200, 5, { isWarmup: true }))).toEqual([]);
  });
});
