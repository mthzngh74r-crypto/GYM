import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/schema';
import { Badge, Button, Card, PageHeader, Section } from '../../components/ui';
import { formatRu, todayISO } from '../../domain/dates';
import { nextCycleDay, sortDays } from '../../domain/cycle';
import { displayStatus, overdueWorkouts, pickCurrentWorkout, STATUS_LABEL } from '../../domain/schedule';
import { moveWorkout, planWorkout, setWorkoutStatus } from '../../db/repo';
import { MUSCLE_LABEL } from '../../domain/muscles';
import type { CycleDay, Workout } from '../../domain/types';
import { useSettings } from '../../hooks/useSettings';

export function TodayPage() {
  const nav = useNavigate();
  const today = todayISO();
  const settings = useSettings();
  const workouts = useLiveQuery(() => db.workouts.toArray(), []);
  const daysRaw = useLiveQuery(() => db.cycleDays.toArray(), []);
  if (!workouts || !daysRaw) return <PageHeader title="Сегодня" />;
  const days = sortDays(daysRaw);

  const current = pickCurrentWorkout(workouts, today);
  const overdue = overdueWorkouts(workouts, today).filter((w) => w.id !== current?.id);
  const suggested = nextCycleDay(days, workouts, today);
  const hasToday = workouts.some((w) => w.date === today && w.status !== 'skipped');
  const upcoming = workouts
    .filter((w) => w.date > today && w.status === 'planned' && w.id !== current?.id)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 5);

  const startSuggested = async () => {
    if (!suggested) return;
    const id = await planWorkout(today, suggested);
    if (!suggested.isRest) nav(`/workout/${id}`);
  };

  return (
    <div>
      <PageHeader title="Сегодня" sub={formatRu(today, 'd MMMM, EEEE')} />
      <div className="p-4 space-y-5">
        {!settings.apiKey && settings.aiEnabled && (
          <Card className="text-sm text-muted" onClick={() => nav('/settings')}>
            ИИ-подбор выключен: нет API-ключа. Упражнения подберутся по правилам. <span className="text-accent">Добавить ключ ›</span>
          </Card>
        )}

        {current ? (
          <CurrentCard w={current} day={days.find((d) => d.id === current.cycleDayId)} onOpen={() => nav(`/workout/${current.id}`)} />
        ) : (
          <Card className="text-center text-muted">На сегодня ничего не запланировано</Card>
        )}

        {!hasToday && suggested && (
          <Card className="space-y-3">
            <div className="text-sm text-muted">Следующий по циклу</div>
            <div className="text-xl font-semibold">
              День {suggested.order} · {suggested.name}
            </div>
            <SlotSummary day={suggested} />
            <Button variant="primary" size="lg" className="w-full" onClick={startSuggested}>
              {suggested.isRest ? 'Отметить отдых сегодня' : 'Тренироваться сегодня'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => nav('/calendar')}>
              Выбрать другой день в календаре
            </Button>
          </Card>
        )}

        {overdue.length > 0 && (
          <Section title="Просроченные">
            {overdue.map((w) => (
              <Card key={w.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      День {w.cycleDayOrder} · {w.cycleDayName}
                    </div>
                    <div className="text-sm text-muted">{formatRu(w.date)}</div>
                  </div>
                  <Badge tone="danger">Просрочена</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => moveWorkout(w.id, today)}>На сегодня</Button>
                  <Button onClick={() => setWorkoutStatus(w.id, 'skipped')}>Пропустить</Button>
                </div>
              </Card>
            ))}
            <div className="text-xs text-muted px-1">
              Пропуск не сбивает цикл: пропущенный день снова будет предложен следующим.
            </div>
          </Section>
        )}

        {upcoming.length > 0 && (
          <Section title="Дальше по плану">
            <div className="rounded-2xl border border-line overflow-hidden divide-y divide-line">
              {upcoming.map((w) => (
                <button
                  key={w.id}
                  onClick={() => (w.isRest ? nav('/calendar') : nav(`/workout/${w.id}`))}
                  className="w-full flex items-center gap-3 bg-surface px-4 py-3 text-left active:bg-surface-2"
                >
                  <span className="w-24 text-sm text-muted">{formatRu(w.date, 'd MMM, EEEEEE')}</span>
                  <span className="flex-1">
                    День {w.cycleDayOrder} · {w.cycleDayName}
                  </span>
                  <span className="text-muted">›</span>
                </button>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function CurrentCard({ w, day, onOpen }: { w: Workout; day?: CycleDay; onOpen: () => void }) {
  const today = todayISO();
  const st = displayStatus(w, today);
  const isToday = w.date === today;
  return (
    <Card className="space-y-3 border-accent/40">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted">{isToday ? 'Сегодня' : formatRu(w.date)}</div>
        <Badge tone={st === 'in_progress' ? 'warn' : st === 'done' ? 'accent' : 'info'}>{STATUS_LABEL[st]}</Badge>
      </div>
      <div className="text-2xl font-bold">
        День {w.cycleDayOrder} · {w.cycleDayName}
      </div>
      {day && <SlotSummary day={day} />}
      {w.isRest ? (
        w.status !== 'done' && (
          <Button variant="primary" size="lg" className="w-full" onClick={() => setWorkoutStatus(w.id, 'done')}>
            Отдохнул ✓
          </Button>
        )
      ) : (
        <Button variant="primary" size="lg" className="w-full" onClick={onOpen}>
          {w.status === 'in_progress' ? 'Продолжить тренировку' : w.status === 'done' ? 'Посмотреть' : 'Открыть тренировку'}
        </Button>
      )}
    </Card>
  );
}

function SlotSummary({ day }: { day: CycleDay }) {
  if (day.isRest) return <div className="text-muted">Восстановление</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {day.slots.map((s) => (
        <Badge key={s.id}>
          {MUSCLE_LABEL[s.muscleGroup]} × {s.count}
        </Badge>
      ))}
    </div>
  );
}
