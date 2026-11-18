import type { Exercise, Settings, WorkoutExercise } from '../domain/types';
import type { GenerationContext, GenerationPlan, PlanItem } from '../generator/types';

export function aiAvailability(settings: Settings): { ok: boolean; reason?: string } {
  if (!settings.aiEnabled) return { ok: false, reason: 'ИИ выключен' };
  if (!settings.apiKey) return { ok: false, reason: 'нет API-ключа' };
  return { ok: false, reason: 'ИИ будет подключён на шаге 5' };
}

export async function generateWithAI(_c: GenerationContext, _e: Exercise[], _s: Settings): Promise<GenerationPlan> {
  throw new Error('not implemented');
}

export async function alternativeWithAI(
  _c: GenerationContext,
  _e: Exercise[],
  _s: Settings,
  _we: WorkoutExercise,
  _cur: string[],
): Promise<{ item: PlanItem; newExercise?: Exercise }> {
  throw new Error('not implemented');
}
