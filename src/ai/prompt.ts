import { GOAL_LABEL, MUSCLE_LABEL } from '../domain/muscles';
import type { Exercise, WorkoutExercise } from '../domain/types';
import type { GenerationContext } from '../generator/types';

export const SYSTEM_PROMPT = `Ты — опытный тренер по силовым тренировкам. Ты подбираешь упражнения для одной запланированной тренировки в личном дневнике пользователя. Пользователь занимается по циклу из нескольких дней, который повторяется по кругу; каждая группа мышц получает нагрузку дважды за цикл. Ответ сразу показывается в приложении на русском языке, поэтому все тексты (explanation, warnings, note, названия новых упражнений) пиши по-русски, коротко и по делу.

Твоя задача — заполнить каждый слот шаблона дня ровно тем числом упражнений, которое указано в слоте, и для каждого указать подходы, диапазон повторений, рабочий вес и отдых.

Правила подбора:
1. Базовые (многосуставные) упражнения ставь в начало тренировки, изолирующие — после них. Порядок элементов в массиве exercises = порядок выполнения.
2. Двойная прогрессия. Если в прошлый раз во всех рабочих подходах упражнения достигнут верх диапазона повторений — добавь вес на шаг (stepKg из контекста) и сохрани диапазон. Если не достигнут — оставь вес и предложи добрать повторы. В поле recommendation истории уже посчитано, что говорят данные: опирайся на него, но учитывай RPE и заметки.
3. Застой. Если прогресса нет 3 тренировки подряд (stalledSessions ≥ 3), предложи замену упражнения на близкое по движению или разгрузку (−10% веса или −1 подход) и обязательно напиши об этом в warnings.
4. Восстановление. Если с прошлой нагрузки на группу мышц прошло меньше 48 часов (under48h = true), снизь объём на эту группу (меньше подходов или более лёгкий вариант) и предупреди в warnings. Учитывай и то, что запланировано на ближайшие дни.
5. Чередование. Упражнения из списка usedInOtherDays делались в другом дне текущего цикла на те же мышцы — не повторяй их, выбери другие. Упражнения из lastTimeInThisDay делались в прошлый раз в этом же дне — их стоит сохранить ради прогрессии, если нет застоя.
6. Используй только доступное оборудование и строго соблюдай ограничения пользователя (травмы, запреты). Если ограничение касается движения, не предлагай ни его, ни похожие варианты.
7. Учитывай цель: масса — умеренные веса и объём в диапазоне повторений из настроек; рельеф — те же веса, отдых короче; сила — для базовых упражнений больше подходов и нижняя часть диапазона, отдых длиннее.
8. Предпочитай упражнения из каталога (поле exerciseId — точный id из candidates). Новое упражнение (exerciseId = null, newExercise заполнен) предлагай, только если в каталоге нет подходящего варианта; его группа мышц и тип должны соответствовать слоту.
9. weightKg — в килограммах, кратно шагу. Если истории нет — null, а в note подскажи, как подобрать стартовый вес (2–3 повтора в запасе). Для упражнений с собственным весом без отягощения — 0 или null.
10. explanation — 1–2 предложения о логике подбора. note к упражнению — одно короткое предложение.

Значения: sets 1–8, repMin ≤ repMax, restSec 30–300.`;

function exLine(e: Exercise): string {
  return `${e.id} | ${e.name} | ${e.kind === 'compound' ? 'базовое' : 'изолирующее'} | ${e.equipment.join('+') || 'без оборудования'}`;
}

/** Компактное текстовое представление контекста для модели. */
export function renderContext(ctx: GenerationContext, exercises: Exercise[]): string {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const name = (id: string) => exById.get(id)?.name ?? id;
  const lines: string[] = [];
  lines.push(`Дата тренировки: ${ctx.date}`);
  lines.push(`День цикла: ${ctx.dayOrder} — «${ctx.dayName}»`);
  lines.push(`Цель: ${GOAL_LABEL[ctx.goal]}`);
  lines.push(`Диапазоны повторений из настроек: базовые ${ctx.repRanges.compound.join('–')}, изолирующие ${ctx.repRanges.isolation.join('–')}`);
  lines.push(`Отдых по умолчанию: базовые ${ctx.restSec.compound} с, изолирующие ${ctx.restSec.isolation} с`);
  lines.push(`Шаг веса (stepKg): ${Math.round(ctx.stepKg * 1000) / 1000}`);
  lines.push(`Доступное оборудование: ${ctx.equipment.join(', ') || 'только собственный вес'}`);
  lines.push(`Ограничения пользователя: ${ctx.limitations.trim() || 'нет'}`);
  const b = ctx.body;
  lines.push(
    `Антропометрия: рост ${b.heightCm ?? '?'} см, вес ${b.weightKg ?? '?'} кг, жир ${b.bodyFatPct ?? '?'}%, ИМТ ${b.bmi ?? '?'}${b.date ? ` (замер ${b.date})` : ''}`,
  );

  lines.push('\n## Восстановление групп мышц этого дня');
  for (const r of ctx.recovery) {
    lines.push(
      `- ${r.muscle} (${MUSCLE_LABEL[r.muscle]}): ${r.lastDate ? `последняя нагрузка ${r.lastDate}, ~${r.hoursSince} ч назад` : 'нет данных'}${r.under48h ? ' — under48h = true' : ''}`,
    );
  }

  lines.push('\n## Соседние тренировки');
  for (const p of ctx.previous) lines.push(`- до: ${p.date} день ${p.dayOrder} «${p.name}» [${p.muscles.join(', ')}] (${p.status})`);
  for (const u of ctx.upcoming) lines.push(`- после: ${u.date} день ${u.dayOrder} «${u.name}» [${u.muscles.join(', ')}] (запланирована)`);
  if (!ctx.previous.length && !ctx.upcoming.length) lines.push('- нет');

  lines.push('\n## Слоты шаблона (заполни каждый ровно count упражнениями)');
  for (const sc of ctx.slots) {
    lines.push(
      `### slotId=${sc.slot.id}: группа ${sc.slot.muscleGroup} (${MUSCLE_LABEL[sc.slot.muscleGroup]}), тип ${sc.slot.kind}, count=${sc.slot.count}`,
    );
    lines.push(`lastTimeInThisDay: ${sc.lastTimeInThisDay.map((id) => `${id} (${name(id)})`).join('; ') || '—'}`);
    lines.push(`usedInOtherDays: ${sc.usedInOtherDays.map((id) => `${id} (${name(id)})`).join('; ') || '—'}`);
    lines.push('candidates (id | название | тип | оборудование):');
    for (const id of sc.candidates) {
      const e = exById.get(id);
      if (e) lines.push(`  ${exLine(e)}`);
    }
  }

  lines.push(`\n## История за последние недели (новые сессии сверху; вес в кг)`);
  if (!ctx.history.length) lines.push('нет истории по этим мышцам');
  for (const h of ctx.history) {
    const r = h.recommendation;
    lines.push(
      `### ${h.exerciseId} — ${h.name} (${h.muscleGroup}, ${h.kind}); диапазон в прошлый раз до ${h.repMaxUsed}; recommendation: ${r.reason}, вес ${r.weightKg ?? '—'}, stalledSessions=${r.stalledSessions}`,
    );
    for (const s of h.sessions) {
      const sets = s.sets.map((x) => `${x.weight}×${x.reps}${x.rpe != null ? `@${x.rpe}` : ''}`).join(', ');
      lines.push(`- ${s.date}: ${sets}${s.notes ? ` — заметка: «${s.notes}»` : ''}`);
    }
  }
  return lines.join('\n');
}

export function planUserMessage(ctx: GenerationContext, exercises: Exercise[]): string {
  return `${renderContext(ctx, exercises)}\n\nПодбери упражнения для этой тренировки по правилам и верни JSON по схеме.`;
}

export function alternativeUserMessage(
  ctx: GenerationContext,
  exercises: Exercise[],
  we: WorkoutExercise,
  currentIds: string[],
): string {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const cur = exById.get(we.exerciseId);
  return `${renderContext(ctx, exercises)}

## Задача
Пользователь просит заменить одно упражнение: ${we.exerciseId} — «${cur?.name ?? '?'}» (slotId=${we.slotId}).
Сейчас в тренировке уже есть: ${currentIds.map((id) => `${id} (${exById.get(id)?.name ?? id})`).join('; ')}.
Предложи ОДНО другое упражнение для этого слота, которого нет в тренировке, с подходами, повторами, весом и отдыхом. В explanation — почему это хорошая замена.`;
}
