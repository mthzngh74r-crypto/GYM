import type { Equipment, ExerciseKind, Goal, MuscleGroup, SlotGroup, SlotKind } from './types';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
];

export const LEG_GROUPS: MuscleGroup[] = ['quads', 'hamstrings', 'glutes'];

export const MUSCLE_LABEL: Record<SlotGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  forearms: 'Предплечья',
  abs: 'Пресс',
  quads: 'Квадрицепс',
  hamstrings: 'Бицепс бедра',
  glutes: 'Ягодицы',
  calves: 'Икры',
  legs: 'Ноги',
};

export const SLOT_GROUPS: SlotGroup[] = ['legs', ...MUSCLE_GROUPS];

export const KIND_LABEL: Record<SlotKind, string> = {
  compound: 'базовое',
  isolation: 'изолирующее',
  any: 'любое',
};

export const KIND_LABEL_PLURAL: Record<ExerciseKind, string> = {
  compound: 'базовые',
  isolation: 'изолирующие',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Штанга',
  dumbbell: 'Гантели',
  machine: 'Тренажёры',
  cable: 'Блоки / кроссовер',
  bodyweight: 'Свой вес',
  pullup_bar: 'Турник',
  dip_bars: 'Брусья',
  bench: 'Скамья',
  kettlebell: 'Гиря',
  ez_bar: 'EZ-гриф',
  smith: 'Машина Смита',
  band: 'Резинки',
};

export const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABEL) as Equipment[];

export const GOAL_LABEL: Record<Goal, string> = {
  mass: 'Масса',
  cut: 'Рельеф',
  strength: 'Сила',
};

/** Подходит ли основная мышца упражнения под группу слота. */
export function slotMatchesMuscle(group: SlotGroup, muscle: MuscleGroup): boolean {
  if (group === 'legs') return LEG_GROUPS.includes(muscle);
  return group === muscle;
}

/** Мышцы, которые реально нагружает слот (для расчёта отдыха между тренировками). */
export function musclesOfSlotGroup(group: SlotGroup): MuscleGroup[] {
  return group === 'legs' ? LEG_GROUPS : [group];
}
