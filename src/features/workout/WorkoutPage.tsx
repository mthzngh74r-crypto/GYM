import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { Badge, Button, Card, Empty, PageHeader, Sheet, inputCls } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useSettings } from '../../hooks/useSettings';
import { useRestTimer } from '../../hooks/useRestTimer';
import { useWakeLock } from '../../hooks/useWakeLock';
import { RestTimerBar } from '../../components/RestTimerBar';
import { ExercisePicker } from '../../components/ExercisePicker';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseMenu } from './ExerciseMenu';
import { addSet, addWorkoutExercise, setWorkoutStatus, startWorkout, updateWorkoutExercise } from '../../db/repo';
import { detectRecord, tonnage } from '../../domain/stats';
import { formatRu } from '../../domain/dates';
import { formatWeight } from '../../domain/units';
import { displayStatus, STATUS_LABEL } from '../../domain/schedule';
import { todayISO } from '../../domain/dates';
import { generateForWorkout, suggestAlternative } from '../../generator/run';
import type { Exercise, WorkoutExercise, WorkSet } from '../../domain/types';

export function WorkoutPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const timer = useRestTimer({ sound: settings.timerSound, vibration: settings.timerVibration });

  const workout = useLiveQuery(() => db.workouts.get(id), [id]);
  const wesRaw = useLiveQuery(() => db.workoutExercises.where('workoutId').equals(id).toArray(), [id]);
  const sets = useLiveQuery(() => db.sets.where('workoutId').equals(id).toArray(), [id]) ?? [];
  const exList = useLiveQuery(() => db.exercises.toArray(), []);
  const cycleDay = useLiveQuery(() => (workout ? db.cycleDays.get(workout.cycleDayId) : undefined), [workout?.cycleDayId]);
  const wes = useMemo(() => [...(wesRaw ?? [])].sort((a, b) => a.order - b.order), [wesRaw]);
  const exIds = useMemo(() => [...new Set(wes.map((w) => w.exerciseId))], [wes]);
  const history = useLiveQuery(
    (): Promise<WorkSet[]> => (exIds.length ? db.sets.where('exerciseId').anyOf(exIds).toArray() : Promise.resolve([])),
    [exIds.join(',')],
  );
  const exercises = useMemo(() => new Map((exList ?? []).map((e) => [e.id, e])), [exList]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<WorkoutExercise | null>(null);
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const autoTried = useRef(false);

  const readOnly = workout?.status === 'done';
  useWakeLock(workout?.status === 'in_progress');

  const runGenerate = async () => {
    if (!workout) return;
    setGenerating(true);
    try {
      const r = await generateForWorkout(workout.id);
      if (r.source === 'rules' && r.fallbackReason) toast(`Подобрано без ИИ: ${r.fallbackReason}`, 'info');
      else toast(r.source === 'ai' ? 'Упражнения подобраны ИИ' : 'Упражнения подобраны', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ошибка подбора', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Автоподбор при открытии, если упражнений ещё нет
  useEffect(() => {
    if (!workout || wesRaw === undefined || autoTried.current) return;
    if (workout.isRest || workout.status === 'done' || workout.status === 'skipped') return;
    autoTried.current = true;
    if (wesRaw.length === 0) void runGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout, wesRaw]);

  // Активное упражнение по умолчанию — первое незавершённое
  useEffect(() => {
    if (activeId && wes.some((w) => w.id === activeId)) return;
    const firstOpen = wes.find((we) => sets.filter((s) => s.workoutExerciseId === we.id && !s.isWarmup).length < we.targetSets);
    setActiveId(firstOpen?.id ?? wes[0]?.id ?? null);
  }, [wes, sets, activeId]);

  if (workout === undefined || exList === undefined || history === undefined || wesRaw === undefined) {
    return <PageHeader title="Тренировка" />;
  }
  if (workout === null || !workout) {
    return (
      <div>
        <PageHeader title="Тренировка" />
        <Empty>Тренировка не найдена</Empty>
      </div>
    );
  }

  const st = displayStatus(workout, todayISO());
  const total = tonnage(sets);
  const workingCount = sets.filter((s) => !s.isWarmup).length;

  const logSet = async (we: WorkoutExercise, d: { weightKg: number; reps: number; rpe: number | null; isWarmup: boolean }) => {
    if (workout.status === 'planned') await startWorkout(workout.id);
    const order = sets.filter((s) => s.workoutExerciseId === we.id).length + 1;
    const created = await addSet({
      workoutExerciseId: we.id,
      workoutId: workout.id,
      exerciseId: we.exerciseId,
      date: workout.date,
      order,
      weight: Math.round(d.weightKg * 1000) / 1000,
      reps: d.reps,
      rpe: d.rpe,
      isWarmup: d.isWarmup,
    });
    const rec = detectRecord(history, created);
    const ex = exercises.get(we.exerciseId);
    if (rec.length) {
      toast(
        `🏆 Новый рекорд${ex ? ` · ${ex.name}` : ''}: ${rec.includes('weight') ? 'максимальный вес' : 'расчётный 1ПМ'} — ${formatWeight(created.weight, settings.units)} × ${created.reps}`,
        'record',
      );
      if (settings.timerVibration && 'vibrate' in navigator) navigator.vibrate(200);
    }
    timer.start(d.isWarmup ? Math.min(60, we.restSec) : we.restSec, ex?.name);
    // после выполнения всех подходов переходим к следующему упражнению
    const done = sets.filter((s) => s.workoutExerciseId === we.id && !s.isWarmup).length + (d.isWarmup ? 0 : 1);
    if (done >= we.targetSets) {
      const idx = wes.findIndex((x) => x.id === we.id);
      const next = wes.slice(idx + 1).find((x) => sets.filter((s) => s.workoutExerciseId === x.id && !s.isWarmup).length < x.targetSets);
      if (next) setActiveId(next.id);
    }
  };

  const moveWe = async (we: WorkoutExercise, dir: -1 | 1) => {
    const i = wes.findIndex((x) => x.id === we.id);
    const j = i + dir;
    if (j < 0 || j >= wes.length) return;
    const a = wes[i];
    const b = wes[j];
    await updateWorkoutExercise(a.id, { order: b.order });
    await updateWorkoutExercise(b.id, { order: a.order });
  };

  const finish = async () => {
    await setWorkoutStatus(workout.id, 'done');
    timer.stop();
    toast(`Тренировка завершена · тоннаж ${formatWeight(total, settings.units)}`, 'success');
    nav('/');
  };

  const slotGroupOf = (we: WorkoutExercise) => cycleDay?.slots.find((s) => s.id === we.slotId)?.muscleGroup ?? exercises.get(we.exerciseId)?.muscleGroup;

  return (
    <div>
      <PageHeader
        title={`День ${workout.cycleDayOrder} · ${workout.cycleDayName}`}
        sub={formatRu(workout.date, 'd MMMM, EEEE')}
        right={
          <Button size="sm" variant="ghost" onClick={() => nav(-1)}>
            ✕
          </Button>
        }
      />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st === 'done' ? 'accent' : st === 'overdue' ? 'danger' : st === 'in_progress' ? 'warn' : 'info'}>{STATUS_LABEL[st]}</Badge>
          {workingCount > 0 && (
            <Badge>
              {workingCount} подх. · {formatWeight(total, settings.units)}
            </Badge>
          )}
        </div>

        {workout.isRest ? (
          <Card className="text-center space-y-3">
            <div className="text-4xl">😴</div>
            <div>День отдыха</div>
            {workout.status !== 'done' && (
              <Button variant="primary" onClick={() => setWorkoutStatus(workout.id, 'done')}>
                Отдохнул ✓
              </Button>
            )}
          </Card>
        ) : (
          <>
            <GenerationInfo
              workoutId={workout.id}
              generating={generating}
              onRegenerate={runGenerate}
              hasExercises={wes.length > 0}
              readOnly={readOnly}
              hasSets={sets.length > 0}
            />

            {wes.map((we) => (
              <ExerciseCard
                key={`${we.id}-${we.exerciseId}`}
                we={we}
                exercise={exercises.get(we.exerciseId)}
                sets={sets.filter((s) => s.workoutExerciseId === we.id)}
                history={history}
                settings={settings}
                active={activeId === we.id}
                readOnly={readOnly}
                onActivate={() => setActiveId(we.id)}
                onLog={(d) => logSet(we, d)}
                onMenu={() => setMenuFor(we)}
              />
            ))}

            {!readOnly && (
              <Button className="w-full" onClick={() => setAdding(true)}>
                + Добавить упражнение
              </Button>
            )}

            <Card className="space-y-2">
              <button className="w-full text-left flex justify-between" onClick={() => setShowNotes(!showNotes)}>
                <span className="text-muted">📝 Заметки к тренировке</span>
                <span className="text-muted">{showNotes ? '▲' : '▼'}</span>
              </button>
              {(showNotes || workout.notes) && (
                <textarea
                  className={`${inputCls} h-24 py-2`}
                  defaultValue={workout.notes}
                  placeholder="Самочувствие, сон, что заметили…"
                  onBlur={(e) => db.workouts.update(workout.id, { notes: e.target.value })}
                />
              )}
            </Card>

            {workout.status === 'planned' && wes.length > 0 && (
              <Button variant="primary" size="lg" className="w-full" onClick={() => startWorkout(workout.id)}>
                Начать тренировку
              </Button>
            )}
            {workout.status === 'in_progress' && (
              <Button variant="primary" size="lg" className="w-full" onClick={finish}>
                Завершить тренировку
              </Button>
            )}
            {workout.status === 'done' && (
              <Button className="w-full" onClick={() => setWorkoutStatus(workout.id, 'in_progress')}>
                Редактировать подходы
              </Button>
            )}
          </>
        )}
      </div>

      <RestTimerBar
        running={timer.running}
        remaining={timer.remaining}
        total={timer.total}
        label={timer.label}
        onAdd={timer.add}
        onStop={timer.stop}
      />

      <ExerciseMenu
        key={menuFor?.id}
        we={menuFor}
        exercise={menuFor ? exercises.get(menuFor.exerciseId) : undefined}
        slotGroup={menuFor ? slotGroupOf(menuFor) : undefined}
        settings={settings}
        excludeIds={exIds}
        onClose={() => setMenuFor(null)}
        onSuggest={async (we) => {
          await suggestAlternative(we.id);
          toast('Упражнение заменено', 'success');
        }}
        onMove={moveWe}
      />

      <Sheet open={adding} onClose={() => setAdding(false)} title="Добавить упражнение">
        <ExercisePicker
          excludeIds={exIds}
          onPick={async (ex: Exercise) => {
            const range = ex.kind === 'compound' ? settings.repRanges.compound : settings.repRanges.isolation;
            const newId = await addWorkoutExercise({
              workoutId: workout.id,
              slotId: 'extra',
              order: (wes.at(-1)?.order ?? 0) + 1,
              exerciseId: ex.id,
              targetSets: 3,
              repMin: range[0],
              repMax: range[1],
              targetWeight: null,
              restSec: ex.kind === 'compound' ? settings.restSec.compound : settings.restSec.isolation,
              aiNote: '',
              notes: '',
            });
            setActiveId(newId);
            setAdding(false);
          }}
        />
      </Sheet>
    </div>
  );
}

function GenerationInfo({
  workoutId,
  generating,
  onRegenerate,
  hasExercises,
  readOnly,
  hasSets,
}: {
  workoutId: string;
  generating: boolean;
  onRegenerate: () => void;
  hasExercises: boolean;
  readOnly: boolean;
  hasSets: boolean;
}) {
  const w = useLiveQuery(() => db.workouts.get(workoutId), [workoutId]);
  const g = w?.generation;
  if (generating) {
    return (
      <Card className="flex items-center gap-3">
        <span className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <span>Подбираю упражнения…</span>
      </Card>
    );
  }
  if (!hasExercises) {
    return (
      <Card className="space-y-3 text-center">
        <div className="text-muted">Упражнений пока нет</div>
        {!readOnly && (
          <Button variant="primary" size="lg" className="w-full" onClick={onRegenerate}>
            ✨ Подобрать упражнения
          </Button>
        )}
      </Card>
    );
  }
  if (!g) return null;
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={g.source === 'ai' ? 'info' : 'muted'}>{g.source === 'ai' ? '✨ ИИ' : g.source === 'rules' ? 'По правилам' : 'Вручную'}</Badge>
        {!readOnly && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!hasSets || confirm('Подобрать заново? Уже записанные подходы сохранятся.')) onRegenerate();
            }}
          >
            ↻ Подобрать заново
          </Button>
        )}
      </div>
      {g.explanation && <div className="text-sm">{g.explanation}</div>}
      {g.warnings.map((wr, i) => (
        <div key={i} className="text-sm text-warn bg-warn/10 rounded-lg p-2">
          ⚠️ {wr}
        </div>
      ))}
    </Card>
  );
}
