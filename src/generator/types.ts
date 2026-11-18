import type { CycleDay, Exercise, ExerciseKind, Goal, MuscleGroup, Settings, Slot, Workout, WorkoutExercise, WorkSet, BodyEntry } from '../domain/types';
import type { Recommendation } from '../domain/progression';

/** Сырые данные из БД, из которых строится контекст. */
export interface ContextInput {
  workout: Workout;
  cycleDays: CycleDay[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  sets: WorkSet[];
  exercises: Exercise[];
  settings: Settings;
  body: BodyEntry | null;
}

export interface MuscleRecovery {
  muscle: MuscleGroup;
  lastDate: string | null;
  /** Часы с последней нагрузки (по датам, день = 24 ч). */
  hoursSince: number | null;
  under48h: boolean;
}

export interface NeighborWorkout {
  date: string;
  dayOrder: number;
  name: string;
  muscles: MuscleGroup[];
  status: Workout['status'];
}

export interface ExerciseHistory {
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup;
  kind: ExerciseKind;
  sessions: { date: string; sets: { weight: number; reps: number; rpe: number | null }[]; notes: string }[];
  recommendation: Recommendation;
  repMaxUsed: number;
}

export interface SlotContext {
  slot: Slot;
  /** Мышцы, которые нагружает слот. */
  muscles: MuscleGroup[];
  /** Упражнения, которые делались в этом слоте в прошлый раз в этом же дне цикла. */
  lastTimeInThisDay: string[];
  /** Упражнения на эти же мышцы из других дней текущего цикла — их нужно чередовать. */
  usedInOtherDays: string[];
  /** Допустимые упражнения из базы (по группе, типу и оборудованию). */
  candidates: string[];
}

export interface GenerationContext {
  date: string;
  dayOrder: number;
  dayName: string;
  slots: SlotContext[];
  goal: Goal;
  equipment: string[];
  limitations: string;
  repRanges: Settings['repRanges'];
  restSec: Settings['restSec'];
  stepKg: number;
  units: Settings['units'];
  body: { heightCm: number | null; weightKg: number | null; bodyFatPct: number | null; bmi: number | null; date: string | null };
  recovery: MuscleRecovery[];
  previous: NeighborWorkout[];
  upcoming: NeighborWorkout[];
  history: ExerciseHistory[];
}

export interface PlanItem {
  slotId: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  weightKg: number | null;
  restSec: number;
  note: string;
}

export interface GenerationPlan {
  explanation: string;
  warnings: string[];
  items: PlanItem[];
  /** Новые упражнения, которых не было в базе (предложены ИИ). */
  newExercises: Exercise[];
}
