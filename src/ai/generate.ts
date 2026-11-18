import type { Exercise, Settings, WorkoutExercise } from '../domain/types';
import type { GenerationContext, GenerationPlan, PlanItem } from '../generator/types';
import { createClient, describeError, requestStructured, type ClientLike } from './client';
import { AiAlternativeSchema, AiPlanSchema, validateAlternative, validatePlan } from './schema';
import { alternativeUserMessage, planUserMessage, SYSTEM_PROMPT } from './prompt';

export interface AiDeps {
  createClient: (apiKey: string) => ClientLike;
}
const defaultDeps: AiDeps = { createClient };

export function aiAvailability(settings: Settings): { ok: boolean; reason?: string } {
  if (!settings.aiEnabled) return { ok: false, reason: 'ИИ выключен в настройках' };
  if (!settings.apiKey) return { ok: false, reason: 'нет API-ключа' };
  if (!settings.model) return { ok: false, reason: 'не выбрана модель' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, reason: 'нет интернета' };
  return { ok: true };
}

export async function generateWithAI(
  ctx: GenerationContext,
  exercises: Exercise[],
  settings: Settings,
  deps: AiDeps = defaultDeps,
): Promise<GenerationPlan> {
  return requestStructured({
    client: deps.createClient(settings.apiKey),
    model: settings.model,
    effort: settings.aiEffort,
    system: SYSTEM_PROMPT,
    user: planUserMessage(ctx, exercises),
    schema: AiPlanSchema,
    validate: (json) => validatePlan(json, ctx, exercises),
  });
}

export async function alternativeWithAI(
  ctx: GenerationContext,
  exercises: Exercise[],
  settings: Settings,
  we: WorkoutExercise,
  currentIds: string[],
  deps: AiDeps = defaultDeps,
): Promise<{ item: PlanItem; newExercise?: Exercise }> {
  const forbidden = [...currentIds.filter((id) => id !== we.exerciseId), we.exerciseId];
  return requestStructured({
    client: deps.createClient(settings.apiKey),
    model: settings.model,
    effort: settings.aiEffort,
    system: SYSTEM_PROMPT,
    user: alternativeUserMessage(ctx, exercises, we, currentIds),
    schema: AiAlternativeSchema,
    validate: (json) => validateAlternative(json, ctx, exercises, we.slotId, forbidden),
  });
}

/** Проверка ключа и модели одним дешёвым запросом к Models API. */
export async function checkApiKey(settings: Settings, deps: AiDeps = defaultDeps): Promise<string> {
  const client = deps.createClient(settings.apiKey);
  if (!client.models) throw new Error('клиент без Models API');
  try {
    await client.models.retrieve(settings.model);
  } catch (e) {
    throw describeError(e);
  }
  return `Ключ работает, модель ${settings.model} доступна`;
}
