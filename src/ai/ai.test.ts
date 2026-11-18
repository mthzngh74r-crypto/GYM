import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { buildContext } from '../generator/context';
import { makeInput, makeWorkout } from '../test/fixtures';
import { SEED_EXERCISES } from '../db/seed/exercises';
import { DEFAULT_SETTINGS } from '../db/defaults';
import { validateAlternative, validatePlan } from './schema';
import { alternativeWithAI, generateWithAI } from './generate';
import { requestExtras, type ClientLike } from './client';
import { renderContext } from './prompt';

const settings = { ...DEFAULT_SETTINGS, apiKey: 'sk-test' };
const day1 = () => buildContext(makeInput(makeWorkout('2026-03-02', 1, 'planned')));

function item(slotId: string, exerciseId: string | null, extra: Record<string, unknown> = {}) {
  return { slotId, exerciseId, newExercise: null, sets: 3, repMin: 8, repMax: 12, weightKg: 40, restSec: 90, note: 'ок', ...extra };
}

function validDay1() {
  return {
    explanation: 'Жимовой день: базовые жимы, затем изоляция.',
    warnings: [],
    exercises: [
      item('d1s1', 'bench_press'),
      item('d1s1', 'db_fly'),
      item('d1s2', 'seated_db_press'),
      item('d1s2', 'lateral_raise'),
      item('d1s3', 'close_grip_bench'),
      item('d1s3', 'rope_pushdown'),
    ],
  };
}

function message(text: string, stop: Anthropic.Beta.Messages.BetaMessage['stop_reason'] = 'end_turn'): Anthropic.Beta.Messages.BetaMessage {
  return {
    id: 'msg',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content: [{ type: 'text', text, citations: null }],
    stop_reason: stop,
    stop_sequence: null,
    usage: {} as Anthropic.Beta.Messages.BetaUsage,
  } as unknown as Anthropic.Beta.Messages.BetaMessage;
}

function mockClient(responses: Anthropic.Beta.Messages.BetaMessage[]) {
  const create = vi.fn(async (_params: unknown) => {
    const r = responses.shift();
    if (!r) throw new Error('no more responses');
    return r;
  });
  const client: ClientLike = { beta: { messages: { create } } };
  return { create, deps: { createClient: () => client } };
}

describe('валидация ответа ИИ', () => {
  it('принимает корректный план', () => {
    const r = validatePlan(validDay1(), day1(), SEED_EXERCISES);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.items).toHaveLength(6);
  });

  it('ловит неверное число упражнений в слоте', () => {
    const plan = validDay1();
    plan.exercises.pop();
    const r = validatePlan(plan, day1(), SEED_EXERCISES);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/d1s3: нужно ровно 2/);
  });

  it('ловит несуществующий id, чужую группу, дубли и неверные диапазоны', () => {
    const plan = validDay1();
    plan.exercises[0] = item('d1s1', 'no_such_id');
    plan.exercises[1] = item('d1s1', 'barbell_curl');
    plan.exercises[2] = item('d1s2', 'lateral_raise');
    plan.exercises[4] = item('d1s3', 'close_grip_bench', { repMin: 12, repMax: 8 });
    const r = validatePlan(plan, day1(), SEED_EXERCISES);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const all = r.errors.join('\n');
      expect(all).toMatch(/no_such_id/);
      expect(all).toMatch(/не подходит к слоту/);
      expect(all).toMatch(/повторяются/);
      expect(all).toMatch(/repMax/);
    }
  });

  it('отклоняет нарушение схемы (zod)', () => {
    const r = validatePlan({ explanation: 'x', exercises: 'нет' }, day1(), SEED_EXERCISES);
    expect(r.ok).toBe(false);
  });

  it('учитывает тип слота (базовое/изолирующее)', () => {
    const ctx = buildContext(makeInput(makeWorkout('2026-03-02', 3, 'planned')));
    const plan = {
      explanation: 'Ноги',
      warnings: [],
      exercises: [
        item('d3s1', 'leg_extension'),
        item('d3s1', 'back_squat'),
        item('d3s2', 'lying_leg_curl'),
        item('d3s2', 'hip_abduction'),
        item('d3s2', 'cable_kickback'),
        item('d3s3', 'standing_calf_raise'),
      ],
    };
    const r = validatePlan(plan, ctx, SEED_EXERCISES);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/требует базовое/);
  });

  it('принимает новое упражнение и создаёт его', () => {
    const plan = validDay1();
    plan.exercises[1] = item('d1s1', null, {
      newExercise: { name: 'Жим Свенда', muscleGroup: 'chest', kind: 'isolation', equipment: [] },
    });
    const r = validatePlan(plan, day1(), SEED_EXERCISES);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.newExercises).toHaveLength(1);
      expect(r.value.newExercises[0]).toMatchObject({ name: 'Жим Свенда', fromAi: true, isCustom: true });
      expect(r.value.items[1].exerciseId).toBe(r.value.newExercises[0].id);
    }
  });

  it('новое упражнение с именем из базы сопоставляется с существующим', () => {
    const plan = validDay1();
    plan.exercises[1] = item('d1s1', null, {
      newExercise: { name: 'разводка гантелей лёжа', muscleGroup: 'chest', kind: 'isolation', equipment: ['dumbbell'] },
    });
    const r = validatePlan(plan, day1(), SEED_EXERCISES);
    expect(r.ok && r.value.items[1].exerciseId).toBe('db_fly');
  });

  it('отклоняет упражнение без нужного оборудования', () => {
    const ctx = buildContext(makeInput(makeWorkout('2026-03-02', 1, 'planned'), [], { equipment: ['dumbbell', 'bench'] }));
    const r = validatePlan(validDay1(), ctx, SEED_EXERCISES);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/оборудования/);
  });

  it('альтернатива не должна совпадать с текущими упражнениями', () => {
    const ctx = day1();
    const bad = validateAlternative({ explanation: 'x', exercise: item('d1s1', 'db_fly') }, ctx, SEED_EXERCISES, 'd1s1', ['db_fly', 'bench_press']);
    expect(bad.ok).toBe(false);
    const good = validateAlternative({ explanation: 'x', exercise: item('d1s1', 'cable_crossover') }, ctx, SEED_EXERCISES, 'd1s1', ['db_fly', 'bench_press']);
    expect(good.ok).toBe(true);
  });
});

describe('вызов модели (замоканный SDK)', () => {
  it('возвращает план при валидном ответе и передаёт нужные параметры', async () => {
    const { create, deps } = mockClient([message(JSON.stringify(validDay1()))]);
    const plan = await generateWithAI(day1(), SEED_EXERCISES, settings, deps);
    expect(plan.items).toHaveLength(6);
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0] as unknown as Record<string, any>;
    expect(params.model).toBe('claude-sonnet-5-5');
    expect(params.output_config.format.type).toBe('json_schema');
    expect(params.output_config.effort).toBe('low');
    expect(params.fallbacks).toBe('default');
    expect(params.system).toMatch(/Двойная прогрессия/);
    expect(params.messages[0].content).toMatch(/slotId=d1s1/);
  });

  it('повторяет запрос с ошибками валидации и принимает исправленный ответ', async () => {
    const broken = validDay1();
    broken.exercises.pop();
    const { create, deps } = mockClient([message(JSON.stringify(broken)), message('не json'), message(JSON.stringify(validDay1()))]);
    const plan = await generateWithAI(day1(), SEED_EXERCISES, settings, deps);
    expect(plan.items).toHaveLength(6);
    expect(create).toHaveBeenCalledTimes(3);
    const second = create.mock.calls[1][0] as unknown as Record<string, any>;
    expect(second.messages).toHaveLength(3);
    expect(second.messages[2].content).toMatch(/нужно ровно 2/);
  });

  it('после 3 неудачных попыток бросает ошибку', async () => {
    const { deps } = mockClient([message('{}'), message('{}'), message('{}')]);
    await expect(generateWithAI(day1(), SEED_EXERCISES, settings, deps)).rejects.toThrow(/некорректный ответ/);
  });

  it('отказ модели — ошибка без повторов', async () => {
    const { create, deps } = mockClient([message('', 'refusal')]);
    await expect(generateWithAI(day1(), SEED_EXERCISES, settings, deps)).rejects.toThrow(/отказалась/);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('«предложи другое» возвращает одно упражнение', async () => {
    const { deps } = mockClient([message(JSON.stringify({ explanation: 'x', exercise: item('d1s1', 'cable_crossover') }))]);
    const we = { id: 'we1', workoutId: 'w', slotId: 'd1s1', order: 0, exerciseId: 'db_fly', targetSets: 3, repMin: 8, repMax: 12, restSec: 90, aiNote: '', notes: '' };
    const r = await alternativeWithAI(day1(), SEED_EXERCISES, settings, we, ['bench_press', 'db_fly'], deps);
    expect(r.item.exerciseId).toBe('cable_crossover');
  });

  it('fallback и effort только для поддерживаемых моделей', () => {
    expect(requestExtras('claude-haiku-5-5', 'low')).toEqual({ effort: 'low' });
    expect(requestExtras('claude-opus-5-5', 'medium')).toMatchObject({ fallbacks: 'default', effort: 'medium' });
    expect(requestExtras('claude-3-old', 'low')).toEqual({ effort: undefined });
  });

  it('контекст содержит кандидатов, восстановление и ограничения', () => {
    const ctx = buildContext(makeInput(makeWorkout('2026-03-02', 1, 'planned'), [], { limitations: 'болит плечо, без жима из-за головы' }));
    const text = renderContext(ctx, SEED_EXERCISES);
    expect(text).toMatch(/болит плечо/);
    expect(text).toMatch(/bench_press \| Жим штанги лёжа/);
    expect(text).toMatch(/Восстановление/);
  });
});
