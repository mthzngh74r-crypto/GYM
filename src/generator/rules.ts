import { MUSCLE_LABEL } from '../domain/muscles';
import { STALL_THRESHOLD } from '../domain/progression';
import { formatWeight } from '../domain/units';
import type { Equipment, Exercise, MuscleGroup } from '../domain/types';
import { isAvailable } from './context';
import type { GenerationContext, GenerationPlan, PlanItem, SlotContext } from './types';

const BASE_SETS = 3;

/** Порядок в тренировке: базовые упражнения раньше изолирующих, иначе — порядок слотов. */
export function orderCompoundsFirst<T extends { exerciseId: string }>(items: T[], exById: Map<string, Exercise>): T[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const ka = exById.get(a.it.exerciseId)?.kind === 'compound' ? 0 : 1;
      const kb = exById.get(b.it.exerciseId)?.kind === 'compound' ? 0 : 1;
      return ka - kb || a.i - b.i;
    })
    .map((x) => x.it);
}

function lastDoneDate(ctx: GenerationContext, id: string): string {
  return ctx.history.find((h) => h.exerciseId === id)?.sessions[0]?.date ?? '';
}

function isStalled(ctx: GenerationContext, id: string): boolean {
  const h = ctx.history.find((x) => x.exerciseId === id);
  return !!h && h.recommendation.stalledSessions >= STALL_THRESHOLD;
}

/**
 * Выбор упражнений для слота:
 * 1) то, что делалось в этом слоте в прошлый раз (для двойной прогрессии), если нет застоя;
 * 2) остальные кандидаты, давно не выполнявшиеся — раньше;
 * упражнения из других дней цикла на те же мышцы исключаются (чередование).
 */
export function pickForSlot(
  sc: SlotContext,
  ctx: GenerationContext,
  exById: Map<string, Exercise>,
  taken: Set<string>,
  count = sc.slot.count,
): { ids: string[]; replaced: { from: string; to: string }[] } {
  const avoid = new Set(sc.usedInOtherDays);
  const free = (id: string) => !taken.has(id) && exById.has(id);
  const pool = sc.candidates.filter(free);
  const preferred = pool.filter((id) => !avoid.has(id));
  const fallback = pool.filter((id) => avoid.has(id));

  const result: string[] = [];
  const replaced: { from: string; to: string }[] = [];
  const stalledPrev: string[] = [];

  for (const id of sc.lastTimeInThisDay) {
    if (result.length >= count) break;
    if (!pool.includes(id)) continue;
    if (isStalled(ctx, id)) {
      stalledPrev.push(id);
      continue;
    }
    result.push(id);
  }

  const rank = (ids: string[]) =>
    [...ids].sort((a, b) => {
      // в слоте «любое» сначала базовое, если базовых ещё нет
      const needCompound = sc.slot.kind === 'any' && !result.some((r) => exById.get(r)?.kind === 'compound');
      if (needCompound) {
        const ka = exById.get(a)?.kind === 'compound' ? 0 : 1;
        const kb = exById.get(b)?.kind === 'compound' ? 0 : 1;
        if (ka !== kb) return ka - kb;
      }
      const da = lastDoneDate(ctx, a);
      const db = lastDoneDate(ctx, b);
      if (da !== db) return da < db ? -1 : 1; // давно не делали (или никогда) — раньше
      // никогда не делали — порядок базы (классика первой), иначе стабильный «случайный»
      if (!da) return sc.candidates.indexOf(a) - sc.candidates.indexOf(b);
      return stableHash(a + ctx.date) - stableHash(b + ctx.date);
    });

  for (const source of [preferred, fallback]) {
    while (result.length < count) {
      const next = rank(source.filter((id) => !result.includes(id) && !stalledPrev.includes(id)))[0];
      if (!next) break;
      result.push(next);
    }
  }
  // если вариантов совсем нет — оставляем упражнение даже с застоем
  for (const id of stalledPrev) if (result.length < count && !result.includes(id)) result.push(id);

  for (const from of stalledPrev) {
    const to = result.find((id) => !sc.lastTimeInThisDay.includes(id));
    if (to && !result.includes(from)) replaced.push({ from, to });
  }
  return { ids: result, replaced };
}

/** Детерминированный «случайный» порядок, чтобы генерация была воспроизводимой. */
function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function planItemFor(
  exerciseId: string,
  slotId: string,
  ctx: GenerationContext,
  exById: Map<string, Exercise>,
  under48: boolean,
): PlanItem {
  const ex = exById.get(exerciseId)!;
  const range = ex.kind === 'compound' ? ctx.repRanges.compound : ctx.repRanges.isolation;
  const restSec = ex.kind === 'compound' ? ctx.restSec.compound : ctx.restSec.isolation;
  const h = ctx.history.find((x) => x.exerciseId === exerciseId);
  let sets = BASE_SETS + (ctx.goal === 'strength' && ex.kind === 'compound' ? 1 : 0);
  if (under48) sets = Math.max(2, sets - 1);
  const notes: string[] = [];
  let weightKg: number | null = null;
  if (h) {
    const r = h.recommendation;
    weightKg = r.weightKg;
    if (r.reason === 'increase' && r.weightKg != null) {
      notes.push(`В прошлый раз верх диапазона во всех подходах — повышаем до ${formatWeight(r.weightKg, ctx.units)}.`);
    } else if (r.reason === 'stalled' && r.weightKg != null) {
      const deload = Math.round((r.weightKg * 0.9) / ctx.stepKg) * ctx.stepKg;
      weightKg = deload;
      notes.push(`Нет прогресса ${r.stalledSessions} тренировки подряд — разгрузка: ${formatWeight(deload, ctx.units)} (−10%).`);
    } else if (r.weightKg != null) {
      notes.push(`Тот же вес, цель — добрать повторы до ${range[1]}.`);
    }
  } else {
    notes.push('Нет истории — подберите вес на 2–3 повтора в запасе.');
  }
  if (under48) notes.push('Объём снижен: группа не успела восстановиться.');
  return { slotId, exerciseId, sets, repMin: range[0], repMax: range[1], weightKg, restSec, note: notes.join(' ') };
}

export function recoveryWarnings(ctx: GenerationContext): { warnings: string[]; tired: Set<MuscleGroup> } {
  const tired = new Set<MuscleGroup>();
  const warnings: string[] = [];
  for (const r of ctx.recovery) {
    if (r.under48h) {
      tired.add(r.muscle);
      warnings.push(`${MUSCLE_LABEL[r.muscle]}: с прошлой нагрузки прошло ~${r.hoursSince} ч (меньше 48 ч) — объём снижен.`);
    }
  }
  return { warnings, tired };
}

/** Генератор на правилах — работает без ИИ и без интернета. */
export function generateByRules(ctx: GenerationContext, exercises: Exercise[]): GenerationPlan {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const taken = new Set<string>();
  const items: PlanItem[] = [];
  const { warnings, tired } = recoveryWarnings(ctx);
  const replacements: string[] = [];
  let emptySlots = 0;

  for (const sc of ctx.slots) {
    const { ids, replaced } = pickForSlot(sc, ctx, exById, taken);
    if (ids.length < sc.slot.count) emptySlots += sc.slot.count - ids.length;
    const under48 = sc.muscles.some((m) => tired.has(m));
    for (const id of ids) {
      taken.add(id);
      items.push(planItemFor(id, sc.slot.id, ctx, exById, under48));
    }
    for (const r of replaced) {
      replacements.push(`«${exById.get(r.from)?.name}» заменено на «${exById.get(r.to)?.name}» — нет прогресса ${STALL_THRESHOLD}+ тренировки.`);
    }
  }
  if (emptySlots > 0) warnings.push(`Не хватило упражнений под оборудование для ${emptySlots} позиций — добавьте их вручную или расширьте оборудование.`);

  const kept = ctx.slots.some((s) => s.lastTimeInThisDay.some((id) => items.some((i) => i.exerciseId === id)));
  const rotated = ctx.slots.some((s) => s.usedInOtherDays.length > 0);
  const parts = [
    kept
      ? 'Упражнения из прошлой такой же тренировки сохранены, чтобы отслеживать прогрессию'
      : 'Первая тренировка этого дня: взяты базовые упражнения из вашей базы и оборудования',
    rotated ? 'упражнения из другого дня цикла на те же мышцы заменены для чередования' : '',
  ];
  const explanation = `Подбор по правилам. ${parts.filter(Boolean).join('; ')}.`;

  return {
    explanation,
    warnings: [...warnings, ...replacements],
    items: orderCompoundsFirst(items, exById),
    newExercises: [],
  };
}

/** Альтернатива для одного упражнения без ИИ. */
export function alternativeByRules(
  ctx: GenerationContext,
  exercises: Exercise[],
  slotId: string,
  currentExerciseIds: string[],
  replacingId: string,
): PlanItem | null {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const sc = ctx.slots.find((s) => s.slot.id === slotId) ?? fallbackSlot(ctx, exById.get(replacingId), exercises);
  if (!sc) return null;
  const taken = new Set([...currentExerciseIds, replacingId]);
  // берём кандидатов, игнорируя «прошлый раз», чтобы получить именно другое упражнение
  const { ids } = pickForSlot({ ...sc, lastTimeInThisDay: [] }, ctx, exById, taken, 1);
  if (!ids[0]) return null;
  const { tired } = recoveryWarnings(ctx);
  return planItemFor(ids[0], sc.slot.id, ctx, exById, sc.muscles.some((m) => tired.has(m)));
}

function fallbackSlot(ctx: GenerationContext, ex: Exercise | undefined, exercises: Exercise[]): SlotContext | null {
  if (!ex) return null;
  const candidates = exercises
    .filter((e) => e.muscleGroup === ex.muscleGroup && isAvailable(e, { equipment: ctx.equipment as Equipment[], limitations: ctx.limitations }))
    .map((e) => e.id);
  return {
    slot: { id: 'extra', muscleGroup: ex.muscleGroup, kind: 'any', count: 1 },
    muscles: [ex.muscleGroup],
    lastTimeInThisDay: [],
    usedInOtherDays: [],
    candidates,
  };
}

