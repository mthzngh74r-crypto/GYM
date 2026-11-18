// Общие типы предметной области. Веса всегда в килограммах, даты — строка YYYY-MM-DD.

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

/** Группа для слота шаблона: конкретная мышца или мета-группа «ноги». */
export type SlotGroup = MuscleGroup | 'legs';

export type ExerciseKind = 'compound' | 'isolation';
export type SlotKind = ExerciseKind | 'any';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'pullup_bar'
  | 'dip_bars'
  | 'bench'
  | 'kettlebell'
  | 'ez_bar'
  | 'smith'
  | 'band';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondary?: MuscleGroup[];
  kind: ExerciseKind;
  /** Всё перечисленное оборудование нужно одновременно. Пустой массив — без оборудования. */
  equipment: Equipment[];
  isCustom: boolean;
  /** Упражнение добавлено ИИ. */
  fromAi?: boolean;
  archived?: boolean;
}

export interface Slot {
  id: string;
  muscleGroup: SlotGroup;
  kind: SlotKind;
  count: number;
}

export interface CycleDay {
  id: string;
  order: number; // 1..N
  name: string;
  isRest: boolean;
  slots: Slot[];
}

export type WorkoutStatus = 'planned' | 'in_progress' | 'done' | 'skipped';

export interface Generation {
  source: 'ai' | 'rules' | 'manual';
  model?: string;
  explanation: string;
  warnings: string[];
  createdAt: number;
}

export interface Workout {
  id: string;
  date: string;
  cycleDayId: string;
  /** Снимок номера и названия дня на момент планирования. */
  cycleDayOrder: number;
  cycleDayName: string;
  isRest: boolean;
  status: WorkoutStatus;
  notes: string;
  startedAt?: number;
  finishedAt?: number;
  generation?: Generation;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  slotId: string;
  order: number;
  exerciseId: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  targetWeight?: number | null;
  restSec: number;
  aiNote: string;
  notes: string;
}

export interface WorkSet {
  id: string;
  workoutExerciseId: string;
  workoutId: string;
  exerciseId: string;
  date: string;
  order: number;
  weight: number;
  reps: number;
  rpe?: number | null;
  isWarmup: boolean;
  createdAt: number;
}

export type Goal = 'mass' | 'cut' | 'strength';
export type Units = 'kg' | 'lb';

export interface Settings {
  id: 'main';
  apiKey: string;
  model: string;
  aiEnabled: boolean;
  aiEffort: 'low' | 'medium' | 'high';
  units: Units;
  weightStep: number; // в выбранных единицах
  heightCm: number | null;
  goal: Goal;
  equipment: Equipment[];
  limitations: string;
  repRanges: { compound: [number, number]; isolation: [number, number] };
  restSec: { compound: number; isolation: number };
  timerSound: boolean;
  timerVibration: boolean;
  historyWeeks: number;
}

export const BODY_FIELDS = [
  'neck',
  'chest',
  'waist',
  'abdomen',
  'hips',
  'bicepsL',
  'bicepsR',
  'forearm',
  'thighL',
  'thighR',
  'calf',
] as const;
export type BodyField = (typeof BODY_FIELDS)[number];

export type BodyEntry = {
  id: string;
  date: string;
  weight: number | null;
  bodyFat: number | null;
} & { [K in BodyField]?: number | null };

export type PhotoPose = 'front' | 'side' | 'back';

export interface Photo {
  id: string;
  date: string;
  pose: PhotoPose;
  blob: Blob;
}
