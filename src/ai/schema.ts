import { z } from 'zod';
import { ALL_EQUIPMENT, MUSCLE_GROUPS, slotMatchesMuscle } from '../domain/muscles';
import type { Equipment, Exercise, MuscleGroup } from '../domain/types';
import type { GenerationContext, GenerationPlan, PlanItem } from '../generator/types';
import { isAvailable } from '../generator/context';

// ---------- Схема ответа модели (structured outputs + zod) ----------

export const NewExerciseSchema = z.object({
  name: z.string().describe('Название упражнения на русском'),
  muscleGroup: z.enum(MUSCLE_GROUPS as [MuscleGroup, ...MuscleGroup[]]),
  kind: z.enum(['compound', 'isolation']),
  equipment: z.array(z.enum(ALL_EQUIPMENT as [Equipment, ...Equipment[]])),
});

export const AiItemSchema = z.object({
  slotId: z.string(),
  exerciseId: z.string().nullable().describe('id из каталога или null, если предлагается новое упражнение'),
  newExercise: NewExerciseSchema.nullable().describe('Заполняется только если exerciseId = null'),
  sets: z.number().int(),
  repMin: z.number().int(),
  repMax: z.number().int(),
  weightKg: z.number().nullable().describe('Рекомендованный рабочий вес в кг; null если истории нет или упражнение с собственным весом'),
  restSec: z.number().int(),
  note: z.string().describe('Короткое пояснение к упражнению: прогрессия, вес, техника'),
});

export const AiPlanSchema = z.object({
  explanation: z.string().describe('1–2 предложения о логике подбора'),
  warnings: z.array(z.string()).describe('Предупреждения: недовосстановление, застой, разгрузка'),
  exercises: z.array(AiItemSchema),
});

export const AiAlternativeSchema = z.object({
  explanation: z.string(),
  exercise: AiItemSchema,
});

export type AiItem = z.infer<typeof AiItemSchema>;
export type AiPlan = z.infer<typeof AiPlanSchema>;

// ---------- Смысловая проверка ----------

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function zodErrors(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.join('.') || '(корень)'}: ${i.message}`);
}

function slug(name: string): string {
  const map: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
  return name
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

interface ItemCheck {
  item?: PlanItem;
  newExercise?: Exercise;
  errors: string[];
}

function checkItem(
  raw: AiItem,
  label: string,
  ctx: GenerationContext,
  exercises: Exercise[],
  exById: Map<string, Exercise>,
  pendingNew: Map<string, Exercise>,
): ItemCheck {
  const errors: string[] = [];
  const sc = ctx.slots.find((s) => s.slot.id === raw.slotId);
  if (!sc) return { errors: [`${label}: неизвестный slotId «${raw.slotId}»`] };
  const settingsLike = { equipment: ctx.equipment as Equipment[], limitations: ctx.limitations };

  let exercise: Exercise | undefined;
  let created: Exercise | undefined;
  if (raw.exerciseId && raw.newExercise) errors.push(`${label}: укажите либо exerciseId, либо newExercise, не оба`);
  if (raw.exerciseId) {
    exercise = exById.get(raw.exerciseId);
    if (!exercise || exercise.archived) errors.push(`${label}: упражнения с id «${raw.exerciseId}» нет в каталоге`);
    else if (!isAvailable(exercise, settingsLike)) errors.push(`${label}: «${exercise.name}» требует недоступного оборудования или противоречит ограничениям`);
  } else if (raw.newExercise) {
    const ne = raw.newExercise;
    const existing = exercises.find((e) => e.name.trim().toLowerCase() === ne.name.trim().toLowerCase() && !e.archived);
    if (existing) {
      exercise = existing;
    } else {
      const key = ne.name.trim().toLowerCase();
      created = pendingNew.get(key) ?? {
        id: `ai_${slug(ne.name) || 'exercise'}_${Math.abs(hash(ne.name)).toString(36).slice(0, 5)}`,
        name: ne.name.trim(),
        muscleGroup: ne.muscleGroup,
        kind: ne.kind,
        equipment: ne.equipment,
        isCustom: true,
        fromAi: true,
      };
      pendingNew.set(key, created);
      exercise = created;
      if (!isAvailable(created, settingsLike)) errors.push(`${label}: новое упражнение «${ne.name}» требует недоступного оборудования`);
    }
  } else {
    errors.push(`${label}: не указано упражнение`);
  }

  if (exercise) {
    if (!slotMatchesMuscle(sc.slot.muscleGroup, exercise.muscleGroup))
      errors.push(`${label}: «${exercise.name}» (${exercise.muscleGroup}) не подходит к слоту группы ${sc.slot.muscleGroup}`);
    if (sc.slot.kind !== 'any' && sc.slot.kind !== exercise.kind)
      errors.push(`${label}: слот требует ${sc.slot.kind === 'compound' ? 'базовое' : 'изолирующее'} упражнение, а «${exercise.name}» — ${exercise.kind}`);
  }
  if (raw.sets < 1 || raw.sets > 8) errors.push(`${label}: sets должно быть от 1 до 8`);
  if (raw.repMin < 1 || raw.repMin > 50) errors.push(`${label}: repMin должно быть от 1 до 50`);
  if (raw.repMax < raw.repMin || raw.repMax > 60) errors.push(`${label}: repMax должно быть ≥ repMin и ≤ 60`);
  if (raw.restSec < 15 || raw.restSec > 600) errors.push(`${label}: restSec должно быть от 15 до 600`);
  if (raw.weightKg != null && (raw.weightKg < 0 || raw.weightKg > 1000)) errors.push(`${label}: weightKg вне разумного диапазона`);

  if (errors.length || !exercise) return { errors };
  return {
    errors,
    newExercise: created,
    item: {
      slotId: raw.slotId,
      exerciseId: exercise.id,
      sets: raw.sets,
      repMin: raw.repMin,
      repMax: raw.repMax,
      weightKg: raw.weightKg == null ? null : Math.round(raw.weightKg * 100) / 100,
      restSec: raw.restSec,
      note: raw.note.trim(),
    },
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Проверяет ответ модели на полный план тренировки. */
export function validatePlan(raw: unknown, ctx: GenerationContext, exercises: Exercise[]): ValidationResult<GenerationPlan> {
  const parsed = AiPlanSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const data = parsed.data;
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const errors: string[] = [];
  const items: PlanItem[] = [];
  const pendingNew = new Map<string, Exercise>();

  data.exercises.forEach((raw, i) => {
    const r = checkItem(raw, `exercises[${i}]`, ctx, exercises, exById, pendingNew);
    errors.push(...r.errors);
    if (r.item) items.push(r.item);
  });

  for (const sc of ctx.slots) {
    const n = data.exercises.filter((x) => x.slotId === sc.slot.id).length;
    if (n !== sc.slot.count) errors.push(`Слот ${sc.slot.id}: нужно ровно ${sc.slot.count} упр., получено ${n}`);
  }
  const ids = items.map((i) => i.exerciseId);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) errors.push(`Упражнения повторяются: ${[...new Set(dup)].join(', ')}`);
  if (!data.explanation.trim()) errors.push('explanation не должно быть пустым');

  if (errors.length) return { ok: false, errors };
  const usedNew = [...pendingNew.values()].filter((e) => ids.includes(e.id));
  return {
    ok: true,
    value: { explanation: data.explanation.trim(), warnings: data.warnings.map((w) => w.trim()).filter(Boolean), items, newExercises: usedNew },
  };
}

/** Проверяет ответ модели на «предложи другое». */
export function validateAlternative(
  raw: unknown,
  ctx: GenerationContext,
  exercises: Exercise[],
  slotId: string,
  forbiddenIds: string[],
): ValidationResult<{ item: PlanItem; newExercise?: Exercise }> {
  const parsed = AiAlternativeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const r = checkItem({ ...parsed.data.exercise, slotId }, 'exercise', withSlot(ctx, slotId, exById, forbiddenIds), exercises, exById, new Map());
  const errors = [...r.errors];
  if (r.item && forbiddenIds.includes(r.item.exerciseId)) errors.push(`exercise: «${exById.get(r.item.exerciseId)?.name}» уже есть в тренировке или заменяется — нужно другое`);
  if (errors.length || !r.item) return { ok: false, errors };
  return { ok: true, value: { item: r.item, newExercise: r.newExercise } };
}

/** Для упражнений, добавленных вручную (slotId = extra), создаём временный слот по группе мышц. */
function withSlot(ctx: GenerationContext, slotId: string, exById: Map<string, Exercise>, forbiddenIds: string[]): GenerationContext {
  if (ctx.slots.some((s) => s.slot.id === slotId)) return ctx;
  const ex = exById.get(forbiddenIds.at(-1) ?? '');
  if (!ex) return ctx;
  return {
    ...ctx,
    slots: [
      ...ctx.slots,
      { slot: { id: slotId, muscleGroup: ex.muscleGroup, kind: 'any', count: 1 }, muscles: [ex.muscleGroup], lastTimeInThisDay: [], usedInOtherDays: [], candidates: [] },
    ],
  };
}
