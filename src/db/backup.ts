import { z } from 'zod';
import type { DiaryDB } from './schema';
import type { Exercise, Settings, Units, Workout, WorkoutExercise, WorkSet } from '../domain/types';
import { MUSCLE_LABEL } from '../domain/muscles';
import { epley1RM } from '../domain/stats';
import { kgToUnit } from '../domain/units';

export const BACKUP_APP = 'workout-diary';
export const BACKUP_VERSION = 1;

const TABLES = ['settings', 'cycleDays', 'exercises', 'workouts', 'workoutExercises', 'sets', 'bodyEntries', 'photos'] as const;
type TableName = (typeof TABLES)[number];

const BackupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.number().int().max(BACKUP_VERSION),
  exportedAt: z.string(),
  tables: z.object({
    settings: z.array(z.record(z.string(), z.unknown())),
    cycleDays: z.array(z.object({ id: z.string(), order: z.number() }).passthrough()),
    exercises: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
    workouts: z.array(z.object({ id: z.string(), date: z.string() }).passthrough()),
    workoutExercises: z.array(z.object({ id: z.string(), workoutId: z.string() }).passthrough()),
    sets: z.array(z.object({ id: z.string(), workoutId: z.string(), weight: z.number(), reps: z.number() }).passthrough()),
    bodyEntries: z.array(z.object({ id: z.string(), date: z.string() }).passthrough()),
    photos: z.array(z.object({ id: z.string(), date: z.string(), dataUrl: z.string() }).passthrough()).optional(),
  }),
});
export type Backup = z.infer<typeof BackupSchema>;

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(bin)}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export async function exportBackup(db: DiaryDB, opts: { includePhotos: boolean; includeApiKey: boolean }): Promise<Backup> {
  const [settings, cycleDays, exercises, workouts, workoutExercises, sets, bodyEntries] = await Promise.all([
    db.settings.toArray(),
    db.cycleDays.toArray(),
    db.exercises.toArray(),
    db.workouts.toArray(),
    db.workoutExercises.toArray(),
    db.sets.toArray(),
    db.bodyEntries.toArray(),
  ]);
  const photos = opts.includePhotos
    ? await Promise.all((await db.photos.toArray()).map(async (p) => ({ id: p.id, date: p.date, pose: p.pose, dataUrl: await blobToDataUrl(p.blob) })))
    : undefined;
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: {
      settings: settings.map((s) => (opts.includeApiKey ? { ...s } : { ...s, apiKey: '' })),
      cycleDays,
      exercises,
      workouts,
      workoutExercises,
      sets,
      bodyEntries,
      ...(photos ? { photos } : {}),
    } as unknown as Backup['tables'],
  };
}

export function parseBackup(json: unknown): Backup {
  const r = BackupSchema.safeParse(json);
  if (!r.success) {
    throw new Error(`Файл не похож на бэкап приложения: ${r.error.issues[0]?.path.join('.')} — ${r.error.issues[0]?.message}`);
  }
  return r.data;
}

/** Полностью заменяет данные содержимым бэкапа. API-ключ сохраняется, если в бэкапе его нет. */
export async function importBackup(db: DiaryDB, backup: Backup): Promise<{ workouts: number; sets: number }> {
  const t = backup.tables;
  const currentKey = (await db.settings.get('main'))?.apiKey ?? '';
  await db.transaction('rw', TABLES.map((n) => db.table(n)), async () => {
    for (const name of TABLES) {
      if (name === 'photos' && !t.photos) continue; // фото не трогаем, если их нет в бэкапе
      await db.table(name as TableName).clear();
    }
    const settings = t.settings.map((s) => ({ ...s, apiKey: (s as Partial<Settings>).apiKey || currentKey }));
    await db.settings.bulkAdd(settings as unknown as Settings[]);
    await db.cycleDays.bulkAdd(t.cycleDays as never[]);
    await db.exercises.bulkAdd(t.exercises as never[]);
    await db.workouts.bulkAdd(t.workouts as never[]);
    await db.workoutExercises.bulkAdd(t.workoutExercises as never[]);
    await db.sets.bulkAdd(t.sets as never[]);
    await db.bodyEntries.bulkAdd(t.bodyEntries as never[]);
    if (t.photos) {
      await db.photos.bulkAdd(
        t.photos.map((p) => ({ id: p.id, date: p.date, pose: (p as { pose?: 'front' | 'side' | 'back' }).pose ?? 'front', blob: dataUrlToBlob(p.dataUrl) })),
      );
    }
  });
  return { workouts: t.workouts.length, sets: t.sets.length };
}

// ---------- CSV ----------

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : v;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** История подходов в CSV (разделитель «;», десятичная запятая — открывается в Excel с русской локалью). */
export function historyToCSV(
  data: { workouts: Workout[]; workoutExercises: WorkoutExercise[]; sets: WorkSet[]; exercises: Exercise[] },
  units: Units,
): string {
  const wById = new Map(data.workouts.map((w) => [w.id, w]));
  const weById = new Map(data.workoutExercises.map((w) => [w.id, w]));
  const exById = new Map(data.exercises.map((e) => [e.id, e]));
  const u = units === 'kg' ? 'кг' : 'lb';
  const header = ['Дата', 'День цикла', 'Тренировка', 'Упражнение', 'Группа мышц', 'Подход', `Вес, ${u}`, 'Повторы', 'RPE', 'Разминка', `1ПМ (Эпли), ${u}`, 'Заметка к упражнению', 'Заметка к тренировке'];
  const rows = [...data.sets]
    .sort((a, b) => (a.date === b.date ? (a.workoutExerciseId === b.workoutExerciseId ? a.order - b.order : (weById.get(a.workoutExerciseId)?.order ?? 0) - (weById.get(b.workoutExerciseId)?.order ?? 0)) : a.date < b.date ? -1 : 1))
    .map((s) => {
      const w = wById.get(s.workoutId);
      const we = weById.get(s.workoutExerciseId);
      const ex = exById.get(s.exerciseId);
      return [
        s.date,
        w?.cycleDayOrder ?? '',
        w?.cycleDayName ?? '',
        ex?.name ?? s.exerciseId,
        ex ? MUSCLE_LABEL[ex.muscleGroup] : '',
        s.order,
        kgToUnit(s.weight, units),
        s.reps,
        s.rpe ?? null,
        s.isWarmup ? 'да' : '',
        s.isWarmup ? null : kgToUnit(epley1RM(s.weight, s.reps), units),
        we?.notes ?? '',
        w?.notes ?? '',
      ];
    });
  return '﻿' + [header, ...rows].map((r) => r.map((c) => csvCell(c as string | number | null)).join(';')).join('\r\n');
}

export function downloadFile(name: string, content: string | Blob, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
