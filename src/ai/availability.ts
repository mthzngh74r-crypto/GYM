import type { Settings } from '../domain/types';

export function aiAvailability(settings: Settings): { ok: boolean; reason?: string } {
  if (!settings.aiEnabled) return { ok: false, reason: 'ИИ выключен в настройках' };
  if (!settings.apiKey) return { ok: false, reason: 'нет API-ключа' };
  if (!settings.model) return { ok: false, reason: 'не выбрана модель' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, reason: 'нет интернета' };
  return { ok: true };
}
