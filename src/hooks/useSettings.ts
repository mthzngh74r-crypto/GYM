import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { DEFAULT_SETTINGS } from '../db/defaults';
import type { Settings } from '../domain/types';

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get('main'), []);
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('main');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await getSettings();
  await db.settings.put({ ...cur, ...patch, id: 'main' });
}
