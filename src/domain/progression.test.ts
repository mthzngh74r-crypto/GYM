import { describe, expect, it } from 'vitest';
import { hitTopOfRange, recommendWeight, sessionsOf, sessionsWithoutProgress, sessionWorkingWeight } from './progression';
import { logWorkout, makeWorkout } from '../test/fixtures';

function history(sessions: [string, [number, number][]][]) {
  return sessions.flatMap(([date, ss]) => logWorkout(makeWorkout(date, 1), [['bench_press', 'd1s1', ss]]).sets);
}

describe('двойная прогрессия', () => {
  it('во всех подходах верх диапазона → +шаг', () => {
    const ss = sessionsOf(history([['2026-01-01', [[80, 10], [80, 10], [80, 10]]]]), 'bench_press');
    expect(hitTopOfRange(ss[0], 10)).toBe(true);
    expect(recommendWeight(ss, 10, 2.5)).toMatchObject({ weightKg: 82.5, reason: 'increase' });
  });

  it('не во всех подходах — вес тот же', () => {
    const ss = sessionsOf(history([['2026-01-01', [[80, 10], [80, 9], [80, 8]]]]), 'bench_press');
    expect(recommendWeight(ss, 10, 2.5)).toMatchObject({ weightKg: 80, reason: 'keep' });
  });

  it('рабочий вес — самый частый в сессии', () => {
    const ss = sessionsOf(history([['2026-01-01', [[60, 10], [80, 8], [80, 8]]]]), 'bench_press');
    expect(sessionWorkingWeight(ss[0])).toBe(80);
  });

  it('без истории — рекомендации нет', () => {
    expect(recommendWeight([], 10, 2.5)).toMatchObject({ weightKg: null, reason: 'no_history' });
  });
});

describe('застой', () => {
  it('3 тренировки без прогресса → stalled', () => {
    const ss = sessionsOf(
      history([
        ['2026-01-01', [[80, 8], [80, 8], [80, 8]]],
        ['2026-01-08', [[80, 8], [80, 7], [80, 7]]],
        ['2026-01-15', [[80, 8], [80, 8], [80, 7]]],
        ['2026-01-22', [[80, 7], [80, 7], [80, 7]]],
      ]),
      'bench_press',
    );
    expect(sessionsWithoutProgress(ss)).toBe(3);
    expect(recommendWeight(ss, 10, 2.5).reason).toBe('stalled');
  });

  it('рост повторов с тем же весом — это прогресс', () => {
    const ss = sessionsOf(
      history([
        ['2026-01-01', [[80, 8], [80, 7], [80, 7]]],
        ['2026-01-08', [[80, 8], [80, 7], [80, 6]]],
        ['2026-01-15', [[80, 8], [80, 8], [80, 7]]],
      ]),
      'bench_press',
    );
    expect(sessionsWithoutProgress(ss)).toBe(0);
  });
});
