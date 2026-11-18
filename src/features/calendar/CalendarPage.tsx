import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { db } from '../../db/schema';
import { Badge, Button, Card, PageHeader, Sheet, inputCls } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { completedCycles, nextCycleDay, sortDays } from '../../domain/cycle';
import { displayStatus, STATUS_LABEL, type DisplayStatus } from '../../domain/schedule';
import { formatRu, todayISO, toISODate } from '../../domain/dates';
import type { CycleDay, Workout } from '../../domain/types';
import { changeWorkoutDay, deleteWorkout, moveWorkout, planMany, planWorkout, setWorkoutStatus } from '../../db/repo';

export const STATUS_COLOR: Record<DisplayStatus, string> = {
  done: 'bg-accent',
  planned: 'bg-info',
  in_progress: 'bg-warn',
  overdue: 'bg-danger',
  skipped: 'bg-muted/50',
  rest: 'bg-line',
};

export function CalendarPage() {
  const today = todayISO();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const toast = useToast();

  const workouts = useLiveQuery(() => db.workouts.toArray(), []) ?? [];
  const days = sortDays(useLiveQuery(() => db.cycleDays.toArray(), []) ?? []);

  const byDate = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of workouts) m.set(w.date, [...(m.get(w.date) ?? []), w]);
    return m;
  }, [workouts]);

  const grid = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const weekdayNames = useMemo(
    () => grid.slice(0, 7).map((d) => format(d, 'EEEEEE', { locale: ru })),
    [grid],
  );

  const cycles = completedCycles(days, workouts);
  const monthKey = format(month, 'yyyy-MM');
  const monthStats = workouts.filter((w) => w.date.startsWith(monthKey) && !w.isRest);
  const doneCount = monthStats.filter((w) => w.status === 'done').length;
  const skippedCount = monthStats.filter((w) => w.status === 'skipped').length;

  const onTap = (iso: string) => {
    if (multi) {
      setPicked((p) => (p.includes(iso) ? p.filter((x) => x !== iso) : [...p, iso]));
    } else setSelected(iso);
  };

  return (
    <div>
      <PageHeader
        title="Календарь"
        sub={`Завершено циклов: ${cycles}`}
        right={
          <Button size="sm" variant={multi ? 'primary' : 'secondary'} onClick={() => { setMulti(!multi); setPicked([]); }}>
            {multi ? 'Готово' : 'Распланировать'}
          </Button>
        }
      />
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Предыдущий месяц">
            ‹
          </Button>
          <button className="text-lg font-semibold capitalize" onClick={() => setMonth(startOfMonth(new Date()))}>
            {format(month, 'LLLL yyyy', { locale: ru })}
          </button>
          <Button variant="ghost" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Следующий месяц">
            ›
          </Button>
        </div>

        {multi && (
          <Card className="text-sm text-muted">
            Отметьте даты тренировок. Дни цикла расставятся по порядку, начиная со следующего после последней тренировки.
          </Card>
        )}

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdayNames.map((n, i) => (
            <div key={i} className="text-xs text-muted pb-1 capitalize">
              {n}
            </div>
          ))}
          {grid.map((d) => {
            const iso = toISODate(d);
            const ws = byDate.get(iso) ?? [];
            const inMonth = isSameMonth(d, month);
            const isToday = iso === today;
            const isPicked = picked.includes(iso);
            return (
              <button
                key={iso}
                onClick={() => onTap(iso)}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-start pt-1 text-sm border ${
                  isPicked ? 'border-accent bg-accent/15' : isToday ? 'border-accent/60 bg-surface' : 'border-transparent bg-surface'
                } ${inMonth ? '' : 'opacity-35'} active:bg-surface-2`}
              >
                <span className={`tabular ${isToday ? 'text-accent font-bold' : ''}`}>{d.getDate()}</span>
                {ws.slice(0, 2).map((w) => (
                  <span
                    key={w.id}
                    className={`mt-0.5 min-w-6 rounded px-1 text-[10px] leading-4 font-semibold text-black ${STATUS_COLOR[displayStatus(w, today)]}`}
                  >
                    {w.isRest ? 'О' : `Д${w.cycleDayOrder}`}
                  </span>
                ))}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted">
          {(['done', 'planned', 'overdue', 'skipped', 'rest'] as DisplayStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`h-3 w-3 rounded ${STATUS_COLOR[s]}`} /> {STATUS_LABEL[s]}
            </span>
          ))}
        </div>

        <Card className="grid grid-cols-3 text-center">
          <Stat value={doneCount} label="выполнено" />
          <Stat value={skippedCount} label="пропущено" />
          <Stat value={cycles} label="циклов всего" />
        </Card>
      </div>

      {multi && picked.length > 0 && (
        <div className="fixed bottom-20 inset-x-0 z-30 px-4">
          <div className="mx-auto max-w-xl">
            <Button
              variant="primary"
              size="lg"
              className="w-full shadow-lg"
              onClick={async () => {
                const n = await planMany(picked);
                toast(`Запланировано: ${n}`, 'success');
                setPicked([]);
                setMulti(false);
              }}
            >
              Расставить дни цикла на {picked.length} дат
            </Button>
          </div>
        </div>
      )}

      <DaySheet
        date={selected}
        onClose={() => setSelected(null)}
        workouts={selected ? byDate.get(selected) ?? [] : []}
        allWorkouts={workouts}
        days={days}
      />
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function DaySheet({
  date,
  onClose,
  workouts,
  allWorkouts,
  days,
}: {
  date: string | null;
  onClose: () => void;
  workouts: Workout[];
  allWorkouts: Workout[];
  days: CycleDay[];
}) {
  const nav = useNavigate();
  const today = todayISO();
  const toast = useToast();
  const suggested = date ? nextCycleDay(days, allWorkouts, date) : undefined;

  return (
    <Sheet open={!!date} onClose={onClose} title={date ? formatRu(date, 'd MMMM yyyy, EEEE') : ''}>
      {workouts.map((w) => (
        <WorkoutActions key={w.id} w={w} days={days} allWorkouts={allWorkouts} onOpen={() => nav(`/workout/${w.id}`)} />
      ))}

      {date && (
        <div className="space-y-2 pt-2">
          <div className="text-sm text-muted">{workouts.length ? 'Добавить ещё' : 'Поставить на эту дату'}</div>
          {suggested && (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={async () => {
                await planWorkout(date, suggested);
                toast(`День ${suggested.order} запланирован`, 'success');
                if (date === today) onClose();
              }}
            >
              День {suggested.order} · {suggested.name} <span className="font-normal opacity-70">(по порядку)</span>
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {days
              .filter((d) => d.id !== suggested?.id)
              .map((d) => (
                <Button key={d.id} onClick={() => planWorkout(date, d)}>
                  День {d.order} · {d.name}
                </Button>
              ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function WorkoutActions({
  w,
  days,
  allWorkouts,
  onOpen,
}: {
  w: Workout;
  days: CycleDay[];
  allWorkouts: Workout[];
  onOpen: () => void;
}) {
  const today = todayISO();
  const st = displayStatus(w, today);
  const [moveTo, setMoveTo] = useState(w.date);
  const [mode, setMode] = useState<'none' | 'move' | 'change'>('none');
  const toast = useToast();
  const tone = st === 'done' ? 'accent' : st === 'overdue' ? 'danger' : st === 'skipped' ? 'muted' : 'info';
  const suggestedForMove = nextCycleDay(days, allWorkouts, moveTo, w.id);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">
          День {w.cycleDayOrder} · {w.cycleDayName}
        </div>
        <Badge tone={tone}>{STATUS_LABEL[st]}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {!w.isRest && (
          <Button variant="primary" onClick={onOpen} className="col-span-2">
            {w.status === 'done' ? 'Открыть' : w.status === 'in_progress' ? 'Продолжить' : 'Открыть тренировку'}
          </Button>
        )}
        {w.isRest && w.status !== 'done' && (
          <Button variant="primary" className="col-span-2" onClick={() => setWorkoutStatus(w.id, 'done')}>
            Отдохнул ✓
          </Button>
        )}
        {w.status !== 'done' && (
          <Button onClick={() => setMode(mode === 'move' ? 'none' : 'move')}>Перенести</Button>
        )}
        {w.status === 'skipped' ? (
          <Button onClick={() => setWorkoutStatus(w.id, 'planned')}>Вернуть</Button>
        ) : w.status !== 'done' ? (
          <Button onClick={() => setWorkoutStatus(w.id, 'skipped')}>Пропустить</Button>
        ) : (
          <Button onClick={() => setWorkoutStatus(w.id, 'in_progress')}>Редактировать</Button>
        )}
        {w.status === 'planned' && <Button onClick={() => setMode(mode === 'change' ? 'none' : 'change')}>Другой день</Button>}
        <Button
          variant="danger"
          onClick={async () => {
            if (confirm('Удалить тренировку вместе с подходами?')) {
              await deleteWorkout(w.id);
              toast('Удалено');
            }
          }}
        >
          Удалить
        </Button>
      </div>
      {mode === 'move' && (
        <div className="space-y-2">
          <input type="date" className={inputCls} value={moveTo} onChange={(e) => setMoveTo(e.target.value)} />
          {suggestedForMove && suggestedForMove.id !== w.cycleDayId && (
            <div className="text-xs text-warn">
              По порядку на эту дату подходит день {suggestedForMove.order}. Цикл не сломается, но порядок изменится.
            </div>
          )}
          <Button
            variant="primary"
            className="w-full"
            disabled={!moveTo || moveTo === w.date}
            onClick={async () => {
              await moveWorkout(w.id, moveTo);
              toast(`Перенесено на ${formatRu(moveTo, 'd MMMM')}`, 'success');
              setMode('none');
            }}
          >
            Перенести на {moveTo ? formatRu(moveTo, 'd MMMM') : '…'}
          </Button>
        </div>
      )}
      {mode === 'change' && (
        <div className="grid grid-cols-2 gap-2">
          {days.map((d) => (
            <Button
              key={d.id}
              variant={d.id === w.cycleDayId ? 'primary' : 'secondary'}
              onClick={async () => {
                await changeWorkoutDay(w.id, d);
                setMode('none');
              }}
            >
              День {d.order} · {d.name}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}
