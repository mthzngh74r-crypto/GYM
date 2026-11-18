import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../../db/schema';
import { Badge, Card, Chip, Empty, PageHeader, Section, inputCls } from '../../components/ui';
import { useSettings } from '../../hooks/useSettings';
import { addDaysISO, formatRu, todayISO } from '../../domain/dates';
import { currentCycleStart } from '../../domain/cycle';
import {
  e1rmSeries,
  personalRecords,
  tonnage,
  tonnageByExercise,
  tonnageByMuscle,
  tonnageByWorkout,
  VOLUME_CORRIDOR,
  volumeZone,
  workingSetsByMuscle,
} from '../../domain/stats';
import { MUSCLE_GROUPS, MUSCLE_LABEL } from '../../domain/muscles';
import { formatNumber, formatWeight, kgToUnit, unitLabel } from '../../domain/units';
import type { Units } from '../../domain/types';

type Period = 'week' | 'cycle' | 'month';
const PERIOD_LABEL: Record<Period, string> = { week: '7 дней', cycle: 'Текущий цикл', month: '28 дней' };

export const CHART = {
  series: '#4ade80',
  grid: '#2a3142',
  axis: '#8b93a7',
  tooltipBg: '#1c2230',
};

export function ProgressPage() {
  const settings = useSettings();
  const units = settings.units;
  const today = todayISO();
  const [period, setPeriod] = useState<Period>('week');
  const sets = useLiveQuery(() => db.sets.toArray(), []);
  const workouts = useLiveQuery(() => db.workouts.toArray(), []);
  const exList = useLiveQuery(() => db.exercises.toArray(), []);
  const days = useLiveQuery(() => db.cycleDays.toArray(), []);
  const exById = useMemo(() => new Map((exList ?? []).map((e) => [e.id, e])), [exList]);

  if (!sets || !workouts || !exList || !days) return <PageHeader title="Прогресс" />;

  const cycleStart = currentCycleStart(days, workouts, today);
  const from =
    period === 'week' ? addDaysISO(today, -6) : period === 'month' ? addDaysISO(today, -27) : (cycleStart ?? addDaysISO(today, -6));
  const inPeriod = sets.filter((s) => s.date >= from && s.date <= today);
  const weekSets = sets.filter((s) => s.date >= addDaysISO(today, -6) && s.date <= today);
  const periodWorkouts = workouts.filter((w) => w.date >= from && w.date <= today && w.status === 'done' && !w.isRest);
  const workingCount = inPeriod.filter((s) => !s.isWarmup).length;

  if (sets.length === 0) {
    return (
      <div>
        <PageHeader title="Прогресс" />
        <Empty>Здесь появятся графики, когда вы запишете первые подходы.</Empty>
      </div>
    );
  }

  const volume = workingSetsByMuscle(weekSets, exById);
  const muscleTon = tonnageByMuscle(inPeriod, exById);
  const exTon = Object.entries(tonnageByExercise(inPeriod))
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const byWorkout = tonnageByWorkout(sets);
  const workoutBars = workouts
    .filter((w) => w.status === 'done' && !w.isRest)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-12)
    .map((w) => ({
      label: formatRu(w.date, 'd.MM'),
      name: `${formatRu(w.date, 'd MMM')} · Д${w.cycleDayOrder}`,
      value: Math.round(kgToUnit(byWorkout[w.id] ?? 0, units)),
    }));

  return (
    <div>
      <PageHeader title="Прогресс" />
      <div className="p-4 space-y-6">
        <div className="flex gap-2 overflow-x-auto">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <Chip key={p} active={period === p} onClick={() => setPeriod(p)}>
              {PERIOD_LABEL[p]}
            </Chip>
          ))}
        </div>
        {period === 'cycle' && (
          <div className="text-xs text-muted -mt-4 px-1">{cycleStart ? `с ${formatRu(cycleStart, 'd MMMM')}` : 'цикл ещё не начат — показаны 7 дней'}</div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Tile label="тоннаж" value={formatWeight(tonnage(inPeriod), units)} />
          <Tile label="тренировок" value={String(periodWorkouts.length)} />
          <Tile label="рабочих подходов" value={String(workingCount)} />
        </div>

        <Section title="Рабочие подходы за 7 дней">
          <Card className="space-y-2">
            <VolumeBars volume={volume} />
            <div className="text-xs text-muted pt-1">
              Полоса — рекомендуемый коридор {VOLUME_CORRIDOR[0]}–{VOLUME_CORRIDOR[1]} рабочих подходов в неделю. Учитывается основная мышца упражнения.
            </div>
          </Card>
        </Section>

        <Section title={`Тоннаж по группам · ${PERIOD_LABEL[period].toLowerCase()}`}>
          <Card>
            <HBarList
              rows={MUSCLE_GROUPS.filter((m) => (muscleTon[m] ?? 0) > 0)
                .map((m) => ({ key: m, label: MUSCLE_LABEL[m], value: muscleTon[m] ?? 0 }))
                .sort((a, b) => b.value - a.value)}
              format={(v) => formatWeight(v, units)}
            />
          </Card>
        </Section>

        <Section title="Тоннаж по тренировкам">
          <Card>
            {workoutBars.length ? (
              <div className="h-48 -ml-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workoutBars} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="0" />
                    <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.grid}`, borderRadius: 12 }}
                      labelStyle={{ color: '#e7eaf0' }}
                      itemStyle={{ color: '#e7eaf0' }}
                      labelFormatter={(_, p) => p?.[0]?.payload?.name ?? ''}
                      formatter={(v) => [`${formatNumber(Number(v), 0)} ${unitLabel(units)}`, 'Тоннаж']}
                    />
                    <Bar dataKey="value" fill={CHART.series} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-muted text-sm">Нет завершённых тренировок</div>
            )}
          </Card>
        </Section>

        <Section title={`Тоннаж по упражнениям · ${PERIOD_LABEL[period].toLowerCase()}`}>
          <Card>
            <HBarList
              rows={exTon.slice(0, 12).map(([id, v]) => ({ key: id, label: exById.get(id)?.name ?? id, value: v }))}
              format={(v) => formatWeight(v, units)}
            />
          </Card>
        </Section>

        <E1RMSection sets={sets} exById={exById} units={units} />
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="!p-3">
      <div className="text-lg font-bold tabular leading-tight">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Card>
  );
}

function VolumeBars({ volume }: { volume: Partial<Record<string, number>> }) {
  const max = Math.max(25, ...Object.values(volume).map((v) => v ?? 0));
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="space-y-2">
      {MUSCLE_GROUPS.map((m) => {
        const v = volume[m] ?? 0;
        const zone = volumeZone(v);
        return (
          <div key={m} className="flex items-center gap-2">
            <div className="w-[5.5rem] shrink-0 text-sm truncate">{MUSCLE_LABEL[m]}</div>
            <div className="relative flex-1 h-5 rounded bg-surface-2 overflow-hidden" title={`${v} подходов`}>
              <div
                className="absolute inset-y-0 bg-accent/10 border-x border-accent/40"
                style={{ left: pct(VOLUME_CORRIDOR[0]), width: pct(VOLUME_CORRIDOR[1] - VOLUME_CORRIDOR[0]) }}
              />
              <div
                className={`absolute inset-y-1 left-0 rounded-r ${zone === 'ok' ? 'bg-accent' : zone === 'high' ? 'bg-warn' : 'bg-muted/60'}`}
                style={{ width: pct(v) }}
              />
            </div>
            <div className="w-8 text-right tabular text-sm">{formatNumber(v)}</div>
            <div className="w-[4.5rem] shrink-0 text-right whitespace-nowrap">
              <Badge tone={zone === 'ok' ? 'accent' : zone === 'high' ? 'warn' : 'muted'}>
                {zone === 'ok' ? '✓ норма' : zone === 'high' ? '▲ много' : '▼ мало'}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HBarList({ rows, format }: { rows: { key: string; label: string; value: number }[]; format: (v: number) => string }) {
  if (!rows.length) return <div className="text-muted text-sm">Нет данных за период</div>;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex justify-between text-sm gap-2">
            <span className="truncate">{r.label}</span>
            <span className="tabular text-muted shrink-0">{format(r.value)}</span>
          </div>
          <div className="h-1.5 rounded bg-surface-2 mt-1">
            <div className="h-1.5 rounded bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function E1RMSection({
  sets,
  exById,
  units,
}: {
  sets: import('../../domain/types').WorkSet[];
  exById: Map<string, import('../../domain/types').Exercise>;
  units: Units;
}) {
  const records = useMemo(() => personalRecords(sets), [sets]);
  const options = [...records.values()]
    .map((r) => ({ id: r.exerciseId, name: exById.get(r.exerciseId)?.name ?? r.exerciseId, rec: r }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const [exId, setExId] = useState<string>('');
  const [showAll, setShowAll] = useState(false);
  const selected = exId && records.has(exId) ? exId : options.find((o) => o.rec.bestE1RM > 0)?.id ?? options[0]?.id ?? '';
  const series = useMemo(
    () =>
      e1rmSeries(sets, selected).map((p) => ({
        ...p,
        label: formatRu(p.date, 'd.MM'),
        value: Math.round(kgToUnit(p.e1rm, units) * 10) / 10,
      })),
    [sets, selected, units],
  );
  const rec = records.get(selected);

  return (
    <>
      <Section title="Расчётный 1ПМ (Эпли)">
        <Card className="space-y-3">
          <select className={inputCls} value={selected} onChange={(e) => setExId(e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {rec && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-surface-2 p-2">
                <div className="text-xs text-muted">Лучший 1ПМ</div>
                <div className="text-lg font-semibold tabular">{formatWeight(rec.bestE1RM, units)}</div>
                <div className="text-xs text-muted">
                  {formatWeight(rec.bestE1RMSet.weight, units, false)}×{rec.bestE1RMSet.reps} · {formatRu(rec.bestE1RMDate, 'd MMM')}
                </div>
              </div>
              <div className="rounded-xl bg-surface-2 p-2">
                <div className="text-xs text-muted">Макс. вес</div>
                <div className="text-lg font-semibold tabular">{formatWeight(rec.maxWeight, units)}</div>
                <div className="text-xs text-muted">
                  ×{rec.maxWeightReps} · {formatRu(rec.maxWeightDate, 'd MMM')}
                </div>
              </div>
            </div>
          )}
          {series.length > 1 ? (
            <div className="h-52 -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip
                    cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
                    contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.grid}`, borderRadius: 12 }}
                    labelStyle={{ color: '#e7eaf0' }}
                    itemStyle={{ color: '#e7eaf0' }}
                    labelFormatter={(_, p) => (p?.[0]?.payload ? formatRu(p[0].payload.date, 'd MMMM') : '')}
                    formatter={(v, _n, p) => [
                      `${formatNumber(Number(v))} ${unitLabel(units)} (${formatWeight(p.payload.weight, units, false)}×${p.payload.reps})`,
                      '1ПМ',
                    ]}
                  />
                  <Line type="monotone" dataKey="value" stroke={CHART.series} strokeWidth={2} dot={{ r: 4, fill: CHART.series, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-sm text-muted">Для графика нужно хотя бы две тренировки с этим упражнением.</div>
          )}
        </Card>
      </Section>

      <Section title="Личные рекорды">
        <div className="rounded-2xl border border-line overflow-hidden divide-y divide-line">
          {(showAll ? options : [...options].sort((a, b) => (a.rec.bestE1RMDate < b.rec.bestE1RMDate ? 1 : -1)).slice(0, 8)).map((o) => (
            <button key={o.id} onClick={() => { setExId(o.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full bg-surface px-4 py-3 text-left active:bg-surface-2 flex gap-3 items-center">
              <span className="flex-1 min-w-0">
                <span className="block truncate">{o.name}</span>
                <span className="block text-xs text-muted">
                  макс. {formatWeight(o.rec.maxWeight, units)}×{o.rec.maxWeightReps} · {formatRu(o.rec.maxWeightDate, 'd MMM yyyy')}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-semibold tabular">{formatWeight(o.rec.bestE1RM, units, false)}</span>
                <span className="block text-xs text-muted">1ПМ</span>
              </span>
            </button>
          ))}
        </div>
        {options.length > 8 && (
          <button className="w-full h-11 text-sm text-accent" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Свернуть (последние рекорды)' : `Показать все (${options.length})`}
          </button>
        )}
      </Section>
    </>
  );
}
