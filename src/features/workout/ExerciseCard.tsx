import { useMemo, useState } from 'react';
import { Badge, Button, Card, Sheet } from '../../components/ui';
import { MUSCLE_LABEL } from '../../domain/muscles';
import { formatNumber, formatWeight, kgToUnit, unitToKg } from '../../domain/units';
import { formatSec } from '../../hooks/useRestTimer';
import { sessionsOf } from '../../domain/progression';
import { formatRu } from '../../domain/dates';
import type { Exercise, Settings, WorkoutExercise, WorkSet } from '../../domain/types';
import { SetInput, type SetDraft } from './SetInput';
import { deleteSet, updateSet } from '../../db/repo';

export function ExerciseCard({
  we,
  exercise,
  sets,
  history,
  settings,
  active,
  readOnly,
  onActivate,
  onLog,
  onMenu,
}: {
  we: WorkoutExercise;
  exercise?: Exercise;
  sets: WorkSet[];
  history: WorkSet[];
  settings: Settings;
  active: boolean;
  readOnly: boolean;
  onActivate: () => void;
  onLog: (draft: { weightKg: number; reps: number; rpe: number | null; isWarmup: boolean }) => Promise<void>;
  onMenu: () => void;
}) {
  const units = settings.units;
  const mySets = useMemo(() => [...sets].sort((a, b) => a.order - b.order), [sets]);
  const lastSession = useMemo(() => sessionsOf(history, we.exerciseId, we.workoutId)[0], [history, we.exerciseId, we.workoutId]);
  const workingDone = mySets.filter((s) => !s.isWarmup).length;
  const complete = workingDone >= we.targetSets;

  const toDisplay = (kg: number | null | undefined) => (kg == null ? null : Math.round(kgToUnit(kg, units) * 100) / 100);

  const initialDraft = (): SetDraft => {
    const lastMine = mySets.filter((s) => !s.isWarmup).at(-1);
    if (lastMine) return { weight: toDisplay(lastMine.weight), reps: lastMine.reps, rpe: null, isWarmup: false };
    const target = we.targetWeight ?? (lastSession ? lastSession.sets[0]?.weight : null);
    return { weight: toDisplay(target ?? null), reps: we.repMax, rpe: null, isWarmup: false };
  };
  const [draft, setDraft] = useState<SetDraft>(initialDraft);
  const [editing, setEditing] = useState<WorkSet | null>(null);
  const [showNote, setShowNote] = useState(false);

  // «повторить прошлый подход»: последний подход в этой тренировке или такой же по счёту в прошлой
  const repeatSource: WorkSet | undefined =
    mySets.at(-1) ?? lastSession?.sets[Math.min(workingDone, (lastSession?.sets.length ?? 1) - 1)];

  const log = async (d: SetDraft) => {
    if (d.weight == null || d.reps == null || d.reps <= 0) return;
    await onLog({ weightKg: unitToKg(d.weight, units), reps: d.reps, rpe: d.rpe, isWarmup: d.isWarmup });
    setDraft({ ...d, rpe: null, isWarmup: false });
  };

  return (
    <Card className={`space-y-3 ${active ? 'border-accent/60' : ''}`}>
      <div className="flex items-start gap-2" onClick={onActivate}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg leading-tight">{exercise?.name ?? 'Упражнение'}</span>
            {complete && <span className="text-accent">✓</span>}
          </div>
          <div className="text-xs text-muted mt-0.5 flex flex-wrap gap-x-2">
            {exercise && <span>{MUSCLE_LABEL[exercise.muscleGroup]}</span>}
            {exercise?.kind === 'compound' && <span>базовое</span>}
          </div>
        </div>
        {!readOnly && (
          <button
            className="h-10 w-10 -mr-2 rounded-full text-xl text-muted active:bg-surface-2"
            aria-label="Меню упражнения"
            onClick={(e) => {
              e.stopPropagation();
              onMenu();
            }}
          >
            ⋯
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-surface-2 p-2">
          <div className="text-xs text-muted">Цель</div>
          <div className="tabular">
            {we.targetSets}×{we.repMin}–{we.repMax}
            {we.targetWeight != null && <> · {formatWeight(we.targetWeight, units)}</>}
          </div>
          <div className="text-xs text-muted">отдых {formatSec(we.restSec)}</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <div className="text-xs text-muted">Прошлый раз{lastSession ? ` · ${formatRu(lastSession.date, 'd MMM')}` : ''}</div>
          {lastSession ? (
            <div className="tabular text-sm leading-snug">
              {lastSession.sets.map((s) => `${formatWeight(s.weight, units, false)}×${s.reps}`).join(' · ')}
            </div>
          ) : (
            <div className="text-muted">нет данных</div>
          )}
        </div>
      </div>

      {we.aiNote && <div className="text-sm text-info/90 bg-info/10 rounded-xl p-2">💡 {we.aiNote}</div>}

      {mySets.length > 0 && (
        <div className="space-y-1">
          {mySets.map((s, i) => (
            <button
              key={s.id}
              disabled={readOnly}
              onClick={() => setEditing(s)}
              className="w-full flex items-center gap-3 rounded-xl px-3 h-11 bg-surface-2 active:bg-line text-left"
            >
              <span className="w-6 text-muted tabular">{s.isWarmup ? 'Р' : i + 1 - mySets.slice(0, i).filter((x) => x.isWarmup).length}</span>
              <span className="flex-1 tabular text-lg">
                {formatWeight(s.weight, units, false)} × {s.reps}
              </span>
              {s.rpe != null && <span className="text-xs text-muted">RPE {formatNumber(s.rpe)}</span>}
              {s.isWarmup && <Badge>разминка</Badge>}
            </button>
          ))}
        </div>
      )}

      {we.notes && !showNote && (
        <div className="text-sm text-muted italic" onClick={() => setShowNote(true)}>
          📝 {we.notes}
        </div>
      )}

      {active && !readOnly && (
        <div className="space-y-3 pt-1">
          <SetInput draft={draft} onChange={setDraft} units={units} step={settings.weightStep} />
          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={!repeatSource}
              onClick={() => repeatSource && log({ weight: toDisplay(repeatSource.weight), reps: repeatSource.reps, rpe: repeatSource.rpe ?? null, isWarmup: repeatSource.isWarmup })}
            >
              {repeatSource ? `↻ ${formatWeight(repeatSource.weight, units, false)}×${repeatSource.reps}` : '↻ Как прошлый'}
            </Button>
            <Button variant="primary" disabled={draft.weight == null || !draft.reps} onClick={() => log(draft)}>
              Записать подход
            </Button>
          </div>
        </div>
      )}

      {!active && !readOnly && (
        <Button size="sm" variant="ghost" className="w-full text-muted" onClick={onActivate}>
          {mySets.length ? `Подходов: ${workingDone}/${we.targetSets} · продолжить` : 'Начать упражнение'}
        </Button>
      )}

      <SetEditSheet set={editing} onClose={() => setEditing(null)} settings={settings} />
    </Card>
  );
}

function SetEditSheet({ set, onClose, settings }: { set: WorkSet | null; onClose: () => void; settings: Settings }) {
  const [draft, setDraft] = useState<SetDraft | null>(null);
  const cur: SetDraft | null =
    draft ??
    (set
      ? {
          weight: Math.round(kgToUnit(set.weight, settings.units) * 100) / 100,
          reps: set.reps,
          rpe: set.rpe ?? null,
          isWarmup: set.isWarmup,
        }
      : null);
  const close = () => {
    setDraft(null);
    onClose();
  };
  return (
    <Sheet open={!!set} onClose={close} title="Подход">
      {set && cur && (
        <>
          <SetInput draft={cur} onChange={setDraft} units={settings.units} step={settings.weightStep} />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="danger"
              onClick={async () => {
                await deleteSet(set.id);
                close();
              }}
            >
              Удалить
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (cur.weight == null || !cur.reps) return;
                await updateSet(set.id, {
                  weight: unitToKg(cur.weight, settings.units),
                  reps: cur.reps,
                  rpe: cur.rpe,
                  isWarmup: cur.isWarmup,
                });
                close();
              }}
            >
              Сохранить
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
