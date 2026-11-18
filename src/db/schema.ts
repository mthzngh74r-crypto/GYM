import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyEntry,
  CycleDay,
  Exercise,
  Photo,
  Settings,
  Workout,
  WorkoutExercise,
  WorkSet,
} from '../domain/types';
import { SEED_EXERCISES } from './seed/exercises';
import { SEED_CYCLE } from './seed/template';
import { DEFAULT_SETTINGS } from './defaults';

export class DiaryDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  cycleDays!: EntityTable<CycleDay, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  sets!: EntityTable<WorkSet, 'id'>;
  bodyEntries!: EntityTable<BodyEntry, 'id'>;
  photos!: EntityTable<Photo, 'id'>;

  constructor(name = 'workout-diary') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      cycleDays: 'id, order',
      exercises: 'id, muscleGroup, kind, name',
      workouts: 'id, date, status, cycleDayId',
      workoutExercises: 'id, workoutId, exerciseId',
      sets: 'id, workoutExerciseId, workoutId, exerciseId, date',
      bodyEntries: 'id, date',
      photos: 'id, date',
    });
    this.on('populate', async (tx) => {
      await tx.table('settings').add(DEFAULT_SETTINGS);
      await tx.table('cycleDays').bulkAdd(SEED_CYCLE);
      await tx.table('exercises').bulkAdd(SEED_EXERCISES);
    });
  }
}

export const db = new DiaryDB();
