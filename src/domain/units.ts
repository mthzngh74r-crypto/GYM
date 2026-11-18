import type { Units } from './types';

export const LB_PER_KG = 2.2046226218;

export function kgToUnit(kg: number, units: Units): number {
  return units === 'kg' ? kg : kg * LB_PER_KG;
}

export function unitToKg(value: number, units: Units): number {
  return units === 'kg' ? value : value / LB_PER_KG;
}

/** Округление до шага (шаг в тех же единицах, что и значение). */
export function roundToStep(value: number, step: number): number {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

export function formatNumber(n: number, digits = 1): string {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return r.toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

/** Отображение веса из кг в выбранных единицах. */
export function formatWeight(kg: number | null | undefined, units: Units, withUnit = true): string {
  if (kg == null) return '—';
  const v = kgToUnit(kg, units);
  const s = formatNumber(v, units === 'kg' ? 2 : 1);
  return withUnit ? `${s} ${unitLabel(units)}` : s;
}

export function unitLabel(units: Units): string {
  return units === 'kg' ? 'кг' : 'lb';
}

/** Шаг веса в кг (настройка хранится в выбранных единицах). */
export function stepInKg(step: number, units: Units): number {
  return unitToKg(step, units);
}
