import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { Badge, Button, Chip, inputCls } from './ui';
import { MUSCLE_GROUPS, MUSCLE_LABEL, slotMatchesMuscle } from '../domain/muscles';
import type { Exercise, MuscleGroup, SlotGroup } from '../domain/types';
import { ExerciseForm } from './ExerciseForm';

/** Список упражнений с поиском и фильтром по группе. */
export function ExercisePicker({
  group,
  onPick,
  excludeIds = [],
  pickLabel,
}: {
  group?: SlotGroup;
  onPick: (ex: Exercise) => void;
  excludeIds?: string[];
  pickLabel?: string;
}) {
  const all = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<SlotGroup | 'all'>(group ?? 'all');
  const [adding, setAdding] = useState(false);

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return all
      .filter((e) => !e.archived && !excludeIds.includes(e.id))
      .filter((e) => filter === 'all' || slotMatchesMuscle(filter, e.muscleGroup))
      .filter((e) => !qq || e.name.toLowerCase().includes(qq))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'ru') : a.kind === 'compound' ? -1 : 1));
  }, [all, q, filter, excludeIds]);

  if (adding) {
    return (
      <ExerciseForm
        defaultGroup={filter !== 'all' && filter !== 'legs' ? (filter as MuscleGroup) : undefined}
        onSaved={(ex) => {
          setAdding(false);
          onPick(ex);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <input className={inputCls} placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          Все
        </Chip>
        {group === 'legs' && (
          <Chip active={filter === 'legs'} onClick={() => setFilter('legs')}>
            Ноги
          </Chip>
        )}
        {MUSCLE_GROUPS.map((g) => (
          <Chip key={g} active={filter === g} onClick={() => setFilter(g)}>
            {MUSCLE_LABEL[g]}
          </Chip>
        ))}
      </div>
      <div className="divide-y divide-line rounded-xl border border-line overflow-hidden">
        {list.map((e) => (
          <button key={e.id} onClick={() => onPick(e)} className="w-full text-left px-3 py-3 bg-surface active:bg-surface-2 flex items-center gap-2">
            <span className="flex-1">
              <span className="block">{e.name}</span>
              <span className="block text-xs text-muted">
                {MUSCLE_LABEL[e.muscleGroup]} · {e.kind === 'compound' ? 'базовое' : 'изолирующее'}
              </span>
            </span>
            {e.isCustom && <Badge tone="info">{e.fromAi ? 'ИИ' : 'своё'}</Badge>}
            {pickLabel && <span className="text-accent text-sm">{pickLabel}</span>}
          </button>
        ))}
        {list.length === 0 && <div className="p-4 text-center text-muted">Ничего не найдено</div>}
      </div>
      <Button className="w-full" onClick={() => setAdding(true)}>
        + Своё упражнение
      </Button>
    </div>
  );
}
