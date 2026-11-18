import type { CycleDay } from '../../domain/types';

export const SEED_CYCLE: CycleDay[] = [
  {
    id: 'day1',
    order: 1,
    name: 'Жимовой',
    isRest: false,
    slots: [
      { id: 'd1s1', muscleGroup: 'chest', kind: 'any', count: 2 },
      { id: 'd1s2', muscleGroup: 'shoulders', kind: 'any', count: 2 },
      { id: 'd1s3', muscleGroup: 'triceps', kind: 'any', count: 2 },
    ],
  },
  {
    id: 'day2',
    order: 2,
    name: 'Тяговый',
    isRest: false,
    slots: [
      { id: 'd2s1', muscleGroup: 'back', kind: 'any', count: 3 },
      { id: 'd2s2', muscleGroup: 'biceps', kind: 'any', count: 2 },
      { id: 'd2s3', muscleGroup: 'abs', kind: 'any', count: 1 },
    ],
  },
  {
    id: 'day3',
    order: 3,
    name: 'Ноги',
    isRest: false,
    slots: [
      { id: 'd3s1', muscleGroup: 'legs', kind: 'compound', count: 2 },
      { id: 'd3s2', muscleGroup: 'legs', kind: 'isolation', count: 3 },
      { id: 'd3s3', muscleGroup: 'calves', kind: 'any', count: 1 },
    ],
  },
  { id: 'day4', order: 4, name: 'Отдых', isRest: true, slots: [] },
  {
    id: 'day5',
    order: 5,
    name: 'Верх',
    isRest: false,
    slots: [
      { id: 'd5s1', muscleGroup: 'chest', kind: 'any', count: 2 },
      { id: 'd5s2', muscleGroup: 'back', kind: 'any', count: 2 },
      { id: 'd5s3', muscleGroup: 'shoulders', kind: 'any', count: 1 },
      { id: 'd5s4', muscleGroup: 'triceps', kind: 'any', count: 1 },
    ],
  },
  {
    id: 'day6',
    order: 6,
    name: 'Ноги',
    isRest: false,
    slots: [
      { id: 'd6s1', muscleGroup: 'legs', kind: 'compound', count: 2 },
      { id: 'd6s2', muscleGroup: 'legs', kind: 'isolation', count: 2 },
      { id: 'd6s3', muscleGroup: 'calves', kind: 'any', count: 1 },
      { id: 'd6s4', muscleGroup: 'abs', kind: 'any', count: 1 },
    ],
  },
];
