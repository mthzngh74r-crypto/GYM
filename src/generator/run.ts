import { db } from '../db/schema';
import { getWorkoutExercises, replaceWorkoutExercises, swapExercise } from '../db/repo';
import { buildContext } from './context';
import { loadContextInput } from './load';
import { alternativeByRules, generateByRules, orderCompoundsFirst } from './rules';
import type { GenerationPlan, PlanItem } from './types';
import type { Generation } from '../domain/types';
import { aiAvailability, generateWithAI, alternativeWithAI } from '../ai/generate';

export interface GenerateResult {
  source: 'ai' | 'rules';
  fallbackReason?: string;
}

/** Подобрать упражнения для тренировки: ИИ, если доступен, иначе правила. */
export async function generateForWorkout(workoutId: string): Promise<GenerateResult> {
  const input = await loadContextInput(workoutId);
  const ctx = buildContext(input);
  if (ctx.slots.length === 0) throw new Error('В шаблоне этого дня нет слотов');

  let plan: GenerationPlan | null = null;
  let source: 'ai' | 'rules' = 'rules';
  let fallbackReason: string | undefined;
  const avail = aiAvailability(input.settings);
  if (avail.ok) {
    try {
      plan = await generateWithAI(ctx, input.exercises, input.settings);
      source = 'ai';
    } catch (e) {
      fallbackReason = e instanceof Error ? e.message : String(e);
    }
  } else if (input.settings.aiEnabled && input.settings.apiKey) {
    fallbackReason = avail.reason;
  }
  if (!plan) plan = generateByRules(ctx, input.exercises);

  await savePlan(workoutId, plan, {
    source,
    model: source === 'ai' ? input.settings.model : undefined,
    explanation: plan.explanation,
    warnings: plan.warnings,
    createdAt: Date.now(),
  });
  return { source, fallbackReason };
}

async function savePlan(workoutId: string, plan: GenerationPlan, generation: Generation) {
  if (plan.newExercises.length) await db.exercises.bulkPut(plan.newExercises);
  const exercises = await db.exercises.toArray();
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const ordered = orderCompoundsFirst(plan.items, exById);
  await replaceWorkoutExercises(workoutId, ordered.map((it, i) => toWorkoutExercise(it, i)));
  await db.workouts.update(workoutId, { generation });
}

function toWorkoutExercise(it: PlanItem, order: number) {
  return {
    slotId: it.slotId,
    order,
    exerciseId: it.exerciseId,
    targetSets: it.sets,
    repMin: it.repMin,
    repMax: it.repMax,
    targetWeight: it.weightKg,
    restSec: it.restSec,
    aiNote: it.note,
    notes: '',
  };
}

/** «Предложи другое» для одного упражнения. */
export async function suggestAlternative(weId: string): Promise<void> {
  const we = await db.workoutExercises.get(weId);
  if (!we) throw new Error('Упражнение не найдено');
  const input = await loadContextInput(we.workoutId);
  const ctx = buildContext(input);
  const current = (await getWorkoutExercises(we.workoutId)).map((x) => x.exerciseId);

  let item: PlanItem | null = null;
  if (aiAvailability(input.settings).ok) {
    try {
      const r = await alternativeWithAI(ctx, input.exercises, input.settings, we, current);
      if (r.newExercise) await db.exercises.put(r.newExercise);
      item = r.item;
    } catch {
      item = null; // тихо падаем на правила
    }
  }
  item ??= alternativeByRules(ctx, input.exercises, we.slotId, current, we.exerciseId);
  if (!item) throw new Error('Нет подходящих альтернатив с вашим оборудованием');
  await swapExercise(we.id, item.exerciseId, {
    targetSets: item.sets,
    repMin: item.repMin,
    repMax: item.repMax,
    targetWeight: item.weightKg,
    restSec: item.restSec,
    aiNote: item.note,
  });
}
