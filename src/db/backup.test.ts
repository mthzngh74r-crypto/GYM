import { describe, expect, it } from 'vitest';
import { DiaryDB } from './schema';
import { exportBackup, historyToCSV, importBackup, parseBackup } from './backup';
import { logWorkout, makeWorkout } from '../test/fixtures';
import { SEED_EXERCISES } from './seed/exercises';

describe('бэкап', () => {
  it('экспорт → импорт восстанавливает данные, ключ не экспортируется по умолчанию', async () => {
    const a = new DiaryDB('backup-a');
    await a.open();
    await a.settings.update('main', { apiKey: 'sk-secret', heightCm: 180 });
    const w = makeWorkout('2026-01-05', 1);
    const { wes, sets } = logWorkout(w, [['bench_press', 'd1s1', [[80, 8], [80, 7]]]]);
    await a.workouts.add(w);
    await a.workoutExercises.bulkAdd(wes);
    await a.sets.bulkAdd(sets);

    const backup = JSON.parse(JSON.stringify(await exportBackup(a, { includePhotos: false, includeApiKey: false })));
    expect(backup.tables.settings[0].apiKey).toBe('');

    const b = new DiaryDB('backup-b');
    await b.open();
    await b.settings.update('main', { apiKey: 'sk-local' });
    const r = await importBackup(b, parseBackup(backup));
    expect(r).toEqual({ workouts: 1, sets: 2 });
    expect(await b.sets.count()).toBe(2);
    expect((await b.settings.get('main'))?.heightCm).toBe(180);
    expect((await b.settings.get('main'))?.apiKey).toBe('sk-local');
    expect(await b.exercises.count()).toBe(await a.exercises.count());
  });

  it('отклоняет чужой файл', () => {
    expect(() => parseBackup({ foo: 1 })).toThrow(/не похож на бэкап/);
  });
});

describe('CSV', () => {
  it('формирует строки с разделителем «;» и десятичной запятой', () => {
    const w = makeWorkout('2026-01-05', 1);
    const { wes, sets } = logWorkout(w, [['bench_press', 'd1s1', [[82.5, 8]]]]);
    w.notes = 'хорошо; бодро';
    const csv = historyToCSV({ workouts: [w], workoutExercises: wes, sets, exercises: SEED_EXERCISES }, 'kg');
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Дата;День цикла/);
    expect(lines[1]).toContain('2026-01-05;1;Жимовой;Жим штанги лёжа;Грудь;1;82,5;8;');
    expect(lines[1]).toContain('104,5'); // 82.5 × (1 + 8/30)
    expect(lines[1]).toContain('"хорошо; бодро"');
  });
});
