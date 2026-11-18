import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { Button, Card, Chip, PageHeader, Toggle, inputCls } from '../../components/ui';
import { sortDays } from '../../domain/cycle';
import { KIND_LABEL, MUSCLE_LABEL, SLOT_GROUPS } from '../../domain/muscles';
import type { CycleDay, Slot, SlotGroup, SlotKind } from '../../domain/types';
import { deleteCycleDay, moveCycleDay, saveCycleDay } from '../../db/repo';
import { uid } from '../../domain/id';
import { SEED_CYCLE } from '../../db/seed/template';
import { useToast } from '../../components/Toast';

export function TemplatePage() {
  const days = sortDays(useLiveQuery(() => db.cycleDays.toArray(), []) ?? []);
  const toast = useToast();

  const addDay = () =>
    saveCycleDay({ id: uid(), order: days.length + 1, name: 'Новый день', isRest: false, slots: [] });

  const reset = async () => {
    if (!confirm('Вернуть шаблон по умолчанию? Запланированные тренировки останутся.')) return;
    await db.transaction('rw', db.cycleDays, async () => {
      await db.cycleDays.clear();
      await db.cycleDays.bulkAdd(SEED_CYCLE);
    });
    toast('Шаблон сброшен', 'success');
  };

  return (
    <div>
      <PageHeader title="Шаблон цикла" sub={`${days.length} дней, повторяется по кругу`} />
      <div className="p-4 space-y-4">
        {days.map((d, i) => (
          <DayEditor key={d.id} day={d} first={i === 0} last={i === days.length - 1} />
        ))}
        <Button variant="primary" className="w-full" onClick={addDay}>
          + Добавить день
        </Button>
        <Button variant="ghost" className="w-full text-muted" onClick={reset}>
          Сбросить к шаблону по умолчанию
        </Button>
      </div>
    </div>
  );
}

function DayEditor({ day, first, last }: { day: CycleDay; first: boolean; last: boolean }) {
  const save = (patch: Partial<CycleDay>) => saveCycleDay({ ...day, ...patch });
  const setSlot = (id: string, patch: Partial<Slot>) =>
    save({ slots: day.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const total = day.slots.reduce((a, s) => a + s.count, 0);

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-10 w-10 shrink-0 rounded-xl bg-surface-2 grid place-items-center font-bold">{day.order}</span>
        <input className={inputCls} value={day.name} onChange={(e) => save({ name: e.target.value })} />
        <div className="flex flex-col">
          <button disabled={first} onClick={() => moveCycleDay(day.id, -1)} className="h-6 w-8 text-muted disabled:opacity-20">
            ▲
          </button>
          <button disabled={last} onClick={() => moveCycleDay(day.id, 1)} className="h-6 w-8 text-muted disabled:opacity-20">
            ▼
          </button>
        </div>
      </div>
      <Toggle checked={day.isRest} onChange={(v) => save({ isRest: v })} label="День отдыха" />
      {!day.isRest && (
        <>
          <div className="text-sm text-muted">Слоты · всего упражнений: {total}</div>
          {day.slots.map((s) => (
            <div key={s.id} className="rounded-xl bg-surface-2 p-3 space-y-2">
              <div className="flex gap-2">
                <select
                  className={inputCls}
                  value={s.muscleGroup}
                  onChange={(e) => setSlot(s.id, { muscleGroup: e.target.value as SlotGroup })}
                >
                  {SLOT_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {MUSCLE_LABEL[g]}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <Button size="md" onClick={() => setSlot(s.id, { count: Math.max(1, s.count - 1) })}>
                    −
                  </Button>
                  <span className="w-6 text-center text-lg font-semibold tabular">{s.count}</span>
                  <Button size="md" onClick={() => setSlot(s.id, { count: Math.min(6, s.count + 1) })}>
                    +
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {(['compound', 'isolation', 'any'] as SlotKind[]).map((k) => (
                  <Chip key={k} active={s.kind === k} onClick={() => setSlot(s.id, { kind: k })}>
                    {KIND_LABEL[k]}
                  </Chip>
                ))}
                <button
                  className="ml-auto h-10 w-10 rounded-full text-danger active:bg-danger/20"
                  aria-label="Удалить слот"
                  onClick={() => save({ slots: day.slots.filter((x) => x.id !== s.id) })}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <Button
            className="w-full"
            onClick={() => save({ slots: [...day.slots, { id: uid(), muscleGroup: 'chest', kind: 'any', count: 1 }] })}
          >
            + Слот
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="text-danger"
        onClick={() => confirm(`Удалить «${day.name}» из шаблона?`) && deleteCycleDay(day.id)}
      >
        Удалить день
      </Button>
    </Card>
  );
}
