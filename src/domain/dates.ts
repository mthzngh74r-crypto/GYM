import { addDays as fnsAddDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

/** Локальная дата в формате YYYY-MM-DD. */
export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseDate(iso: string): Date {
  return parseISO(iso);
}

export function addDaysISO(iso: string, n: number): string {
  return toISODate(fnsAddDays(parseISO(iso), n));
}

/** b - a в календарных днях. */
export function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

export function formatRu(iso: string, pattern = 'd MMMM, EEEEEE'): string {
  return format(parseISO(iso), pattern, { locale: ru });
}

export function formatRuDateTime(ts: number): string {
  return format(new Date(ts), 'd MMM HH:mm', { locale: ru });
}
