import { useState } from 'react';
import { Button, Card, Section, Toggle } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { db } from '../../db/schema';
import { downloadFile, exportBackup, historyToCSV, importBackup, parseBackup } from '../../db/backup';
import { useSettings } from '../../hooks/useSettings';
import { todayISO } from '../../domain/dates';

export function BackupSection() {
  const toast = useToast();
  const settings = useSettings();
  const [withPhotos, setWithPhotos] = useState(false);
  const [withKey, setWithKey] = useState(false);
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const data = await exportBackup(db, { includePhotos: withPhotos, includeApiKey: withKey });
      downloadFile(`workout-diary-${todayISO()}.json`, JSON.stringify(data));
      toast('Бэкап сохранён', 'success');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      const when = new Date(backup.exportedAt).toLocaleString('ru-RU');
      if (!confirm(`Заменить все текущие данные бэкапом от ${when}? Это действие нельзя отменить.`)) return;
      const r = await importBackup(db, backup);
      toast(`Импортировано: ${r.workouts} тренировок, ${r.sets} подходов`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось прочитать файл', 'error');
    }
  };

  const doCsv = async () => {
    const [workouts, workoutExercises, sets, exercises] = await Promise.all([
      db.workouts.toArray(),
      db.workoutExercises.toArray(),
      db.sets.toArray(),
      db.exercises.toArray(),
    ]);
    downloadFile(`workout-history-${todayISO()}.csv`, historyToCSV({ workouts, workoutExercises, sets, exercises }, settings.units), 'text/csv;charset=utf-8');
  };

  return (
    <Section title="Резервная копия">
      <Card className="space-y-3">
        <div className="text-sm text-muted">
          Все данные хранятся только в этом браузере. Делайте бэкап регулярно — при очистке данных сайта или смене телефона они пропадут.
        </div>
        <Toggle checked={withPhotos} onChange={setWithPhotos} label="Включить фото (файл будет большим)" />
        <Toggle checked={withKey} onChange={setWithKey} label="Включить API-ключ" />
        <Button variant="primary" className="w-full" disabled={busy} onClick={doExport}>
          {busy ? 'Готовлю…' : '⬇ Экспорт всех данных (JSON)'}
        </Button>
        <label className="flex h-12 items-center justify-center rounded-xl bg-surface-2 border border-line active:bg-line">
          ⬆ Импорт из JSON
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => doImport(e.target.files?.[0]).then(() => (e.target.value = ''))} />
        </label>
        <Button className="w-full" onClick={doCsv}>
          📄 Экспорт истории в CSV
        </Button>
      </Card>
    </Section>
  );
}
