import type { BodyEntry, BodyField } from './types';

export function bmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

export function bmiCategory(v: number | null): string {
  if (v == null) return '';
  if (v < 18.5) return 'недостаток веса';
  if (v < 25) return 'норма';
  if (v < 30) return 'избыточный вес';
  return 'ожирение';
}

export const BODY_LABEL: Record<BodyField | 'weight' | 'bodyFat', string> = {
  weight: 'Вес тела',
  bodyFat: '% жира',
  neck: 'Шея',
  chest: 'Грудь',
  waist: 'Талия',
  abdomen: 'Живот',
  hips: 'Бёдра / ягодицы',
  bicepsL: 'Бицепс Л',
  bicepsR: 'Бицепс П',
  forearm: 'Предплечье',
  thighL: 'Бедро Л',
  thighR: 'Бедро П',
  calf: 'Голень',
};

export type BodyMetric = keyof typeof BODY_LABEL;

/** Последнее известное значение каждого показателя на дату. */
export function latestValue(entries: BodyEntry[], metric: BodyMetric, onOrBefore?: string): { value: number; date: string } | null {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const e of sorted) {
    if (onOrBefore && e.date > onOrBefore) continue;
    const v = e[metric as keyof BodyEntry];
    if (typeof v === 'number') return { value: v, date: e.date };
  }
  return null;
}
