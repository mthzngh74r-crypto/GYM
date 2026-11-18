import { describe, expect, it } from 'vitest';
import { buildContext } from './context';
import { alternativeByRules, generateByRules } from './rules';
import { logWorkout, makeInput, makeWorkout } from '../test/fixtures';
import { SEED_EXERCISES } from '../db/seed/exercises';
import { SEED_CYCLE } from '../db/seed/template';

const exById = new Map(SEED_EXERCISES.map((e) => [e.id, e]));

function slotCounts(items: { slotId: string }[]) {
  return items.reduce<Record<string, number>>((a, i) => ((a[i.slotId] = (a[i.slotId] ?? 0) + 1), a), {});
}

describe('генератор на правилах', () => {
  it('заполняет все слоты нужным числом упражнений без повторов', () => {
    for (const day of SEED_CYCLE.filter((d) => !d.isRest)) {
      const w = makeWorkout('2026-03-02', day.order, 'planned');
      const plan = generateByRules(buildContext(makeInput(w)), SEED_EXERCISES);
      const expected = Object.fromEntries(day.slots.map((s) => [s.id, s.count]));
      expect(slotCounts(plan.items)).toEqual(expected);
      expect(new Set(plan.items.map((i) => i.exerciseId)).size).toBe(plan.items.length);
    }
  });

  it('соблюдает тип слота и группу мышц (ноги: базовые/изолирующие)', () => {
    const w = makeWorkout('2026-03-02', 3, 'planned');
    const plan = generateByRules(buildContext(makeInput(w)), SEED_EXERCISES);
    for (const it of plan.items) {
      const ex = exById.get(it.exerciseId)!;
      if (it.slotId === 'd3s1') expect(ex.kind).toBe('compound');
      if (it.slotId === 'd3s2') expect(ex.kind).toBe('isolation');
      if (it.slotId !== 'd3s3') expect(['quads', 'hamstrings', 'glutes']).toContain(ex.muscleGroup);
      else expect(ex.muscleGroup).toBe('calves');
    }
  });

  it('базовые упражнения стоят в начале', () => {
    const w = makeWorkout('2026-03-02', 1, 'planned');
    const plan = generateByRules(buildContext(makeInput(w)), SEED_EXERCISES);
    const kinds = plan.items.map((i) => exById.get(i.exerciseId)!.kind);
    const firstIso = kinds.indexOf('isolation');
    if (firstIso >= 0) expect(kinds.slice(firstIso)).not.toContain('compound');
  });

  it('учитывает оборудование', () => {
    const w = makeWorkout('2026-03-02', 1, 'planned');
    const plan = generateByRules(buildContext(makeInput(w, [], { equipment: ['dumbbell', 'bench'] })), SEED_EXERCISES);
    for (const it of plan.items) {
      expect(exById.get(it.exerciseId)!.equipment.every((e) => ['dumbbell', 'bench', 'bodyweight'].includes(e))).toBe(true);
    }
  });

  it('чередует упражнения между днями цикла на одну группу', () => {
    // День 1 (жимовой) в этом цикле: грудь — жим штанги и жим гантелей на наклонной
    const d1 = makeWorkout('2026-03-02', 1);
    const past = { w: d1, ...logWorkout(d1, [
      ['bench_press', 'd1s1', [[80, 8]]],
      ['incline_db_press', 'd1s1', [[30, 10]]],
    ]) };
    const d5 = makeWorkout('2026-03-06', 5, 'planned');
    const ctx = buildContext(makeInput(d5, [past]));
    expect(ctx.slots[0].usedInOtherDays).toEqual(expect.arrayContaining(['bench_press', 'incline_db_press']));
    const plan = generateByRules(ctx, SEED_EXERCISES);
    const chest = plan.items.filter((i) => i.slotId === 'd5s1').map((i) => i.exerciseId);
    expect(chest).toHaveLength(2);
    expect(chest).not.toContain('bench_press');
    expect(chest).not.toContain('incline_db_press');
  });

  it('сохраняет упражнения прошлой такой же тренировки и применяет двойную прогрессию', () => {
    const prev = makeWorkout('2026-02-23', 1);
    const past = { w: prev, ...logWorkout(prev, [['bench_press', 'd1s1', [[80, 10], [80, 10], [80, 10]], 10]]) };
    const w = makeWorkout('2026-03-02', 1, 'planned');
    const plan = generateByRules(buildContext(makeInput(w, [past])), SEED_EXERCISES);
    const bench = plan.items.find((i) => i.exerciseId === 'bench_press');
    expect(bench).toBeDefined();
    expect(bench!.weightKg).toBe(82.5);
    expect(bench!.note).toMatch(/повышаем/);
  });

  it('при застое 3 тренировки подряд заменяет упражнение', () => {
    const past = ['2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16'].map((date, i) => {
      const w = makeWorkout(date, 1);
      const reps = i === 0 ? 8 : 7;
      return { w, ...logWorkout(w, [['bench_press', 'd1s1', [[80, reps], [80, reps], [80, 7]]]]) };
    });
    const w = makeWorkout('2026-02-23', 1, 'planned');
    const plan = generateByRules(buildContext(makeInput(w, past)), SEED_EXERCISES);
    expect(plan.items.map((i) => i.exerciseId)).not.toContain('bench_press');
    expect(plan.warnings.join(' ')).toMatch(/Жим штанги лёжа.*заменено/);
  });

  it('меньше 48 часов с прошлой нагрузки: меньше подходов и предупреждение', () => {
    const d5 = makeWorkout('2026-03-01', 5);
    const past = { w: d5, ...logWorkout(d5, [['bench_press', 'd5s1', [[80, 8]]]]) };
    const w = makeWorkout('2026-03-02', 1, 'planned');
    const ctx = buildContext(makeInput(w, [past]));
    expect(ctx.recovery.find((r) => r.muscle === 'chest')).toMatchObject({ hoursSince: 24, under48h: true });
    const plan = generateByRules(ctx, SEED_EXERCISES);
    expect(plan.warnings.some((x) => x.startsWith('Грудь'))).toBe(true);
    const chest = plan.items.filter((i) => i.slotId === 'd1s1');
    expect(chest.every((i) => i.sets === 2)).toBe(true);
    const tri = plan.items.filter((i) => i.slotId === 'd1s3');
    expect(tri.every((i) => i.sets === 3)).toBe(true);
  });

  it('альтернатива — другое упражнение той же группы', () => {
    const w = makeWorkout('2026-03-02', 1, 'planned');
    const ctx = buildContext(makeInput(w));
    const alt = alternativeByRules(ctx, SEED_EXERCISES, 'd1s1', ['bench_press', 'db_fly'], 'bench_press');
    expect(alt).not.toBeNull();
    expect(['bench_press', 'db_fly']).not.toContain(alt!.exerciseId);
    expect(exById.get(alt!.exerciseId)!.muscleGroup).toBe('chest');
  });
});

describe('контекст', () => {
  it('соседние тренировки и запланированное на ближайшие дни', () => {
    const d1 = makeWorkout('2026-03-02', 1);
    const past = { w: d1, ...logWorkout(d1, [['bench_press', 'd1s1', [[80, 8]]]]) };
    const w = makeWorkout('2026-03-03', 2, 'planned');
    const next = makeWorkout('2026-03-05', 3, 'planned');
    const ctx = buildContext(makeInput(w, [past], {}, [next]));
    expect(ctx.previous.map((p) => p.date)).toEqual(['2026-03-02']);
    expect(ctx.upcoming[0]).toMatchObject({ date: '2026-03-05', dayOrder: 3 });
    expect(ctx.upcoming[0].muscles).toContain('quads');
  });

  it('история ограничена окном недель', () => {
    const old = makeWorkout('2025-12-01', 1);
    const recent = makeWorkout('2026-02-23', 1);
    const w = makeWorkout('2026-03-02', 1, 'planned');
    const ctx = buildContext(
      makeInput(w, [
        { w: old, ...logWorkout(old, [['db_fly', 'd1s1', [[20, 10]]]]) },
        { w: recent, ...logWorkout(recent, [['bench_press', 'd1s1', [[80, 8]]]]) },
      ]),
    );
    expect(ctx.history.map((h) => h.exerciseId)).toEqual(['bench_press']);
  });
});
