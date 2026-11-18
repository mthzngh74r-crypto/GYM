import type { Settings } from '../domain/types';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

export const MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (по умолчанию)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (дешевле, быстрее)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (умнее, дороже)' },
];

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  apiKey: '',
  model: DEFAULT_MODEL,
  aiEnabled: true,
  aiEffort: 'low',
  units: 'kg',
  weightStep: 2.5,
  heightCm: null,
  goal: 'mass',
  equipment: [
    'barbell',
    'dumbbell',
    'machine',
    'cable',
    'bodyweight',
    'pullup_bar',
    'dip_bars',
    'bench',
    'ez_bar',
    'smith',
  ],
  limitations: '',
  repRanges: { compound: [6, 10], isolation: [10, 15] },
  restSec: { compound: 150, isolation: 90 },
  timerSound: true,
  timerVibration: true,
  historyWeeks: 6,
};
