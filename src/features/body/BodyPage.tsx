import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../../db/schema';
import { Button, Card, Chip, Empty, Field, PageHeader, Section, Sheet, inputCls } from '../../components/ui';
import { NumInput } from '../../components/NumInput';
import { useSettings } from '../../hooks/useSettings';
import { BODY_LABEL, bmi, bmiCategory, latestValue, type BodyMetric } from '../../domain/body';
import { formatRu, todayISO } from '../../domain/dates';
import { formatNumber } from '../../domain/units';
import { uid } from '../../domain/id';
import { BODY_FIELDS, type BodyEntry } from '../../domain/types';
import { CHART } from '../../components/chartTheme';
import { PhotosTab } from './PhotosTab';

type Tab = 'entries' | 'charts' | 'compare' | 'photos';
const METRICS: BodyMetric[] = ['weight', 'bodyFat', ...BODY_FIELDS];
const unitOf = (m: BodyMetric) => (m === 'weight' ? 'кг' : m === 'bodyFat' ? '%' : 'см');

export function BodyPage() {
  const [tab, setTab] = useState<Tab>('entries');
  const [editing, setEditing] = useState<BodyEntry | null>(null);
  const settings = useSettings();
  const nav = useNavigate();
  const entries = useLiveQuery(() => db.bodyEntries.orderBy('date').reverse().toArray(), []);
  if (!entries) return <PageHeader title="Тело" />;

  const lastWeight = latestValue(entries, 'weight');
  const lastFat = latestValue(entries, 'bodyFat');
  const b = bmi(lastWeight?.value, settings.heightCm);

  const newEntry = (): BodyEntry => ({ id: uid(), date: todayISO(), weight: lastWeight?.value ?? null, bodyFat: null });

  return (
    <div>
      <PageHeader
        title="Тело"
        right={
          <Button size="sm" variant="primary" onClick={() => setEditing(newEntry())}>
            + Замер
          </Button>
        }
      />
      <div className="p-4 space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <Card className="!p-3">
            <div className="text-lg font-bold tabular">{lastWeight ? `${formatNumber(lastWeight.value)} кг` : '—'}</div>
            <div className="text-xs text-muted">вес</div>
          </Card>
          <Card className="!p-3" onClick={settings.heightCm ? undefined : () => nav('/settings')}>
            <div className="text-lg font-bold tabular">{b != null ? formatNumber(b) : '—'}</div>
            <div className="text-xs text-muted">{b ? `ИМТ · ${bmiCategory(b)}` : settings.heightCm ? 'ИМТ' : 'ИМТ: укажите рост ›'}</div>
          </Card>
          <Card className="!p-3">
            <div className="text-lg font-bold tabular">{lastFat ? `${formatNumber(lastFat.value)}%` : '—'}</div>
            <div className="text-xs text-muted">жир</div>
          </Card>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {(
            [
              ['entries', 'Записи'],
              ['charts', 'Графики'],
              ['compare', 'Сравнение'],
              ['photos', 'Фото'],
            ] as [Tab, string][]
          ).map(([t, l]) => (
            <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
              {l}
            </Chip>
          ))}
        </div>

        {tab === 'entries' && <EntriesTab entries={entries} onEdit={setEditing} />}
        {tab === 'charts' && <ChartsTab entries={entries} />}
        {tab === 'compare' && <CompareTab entries={entries} />}
        {tab === 'photos' && <PhotosTab />}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Замер">
        {editing && <EntryForm key={editing.id} initial={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function EntriesTab({ entries, onEdit }: { entries: BodyEntry[]; onEdit: (e: BodyEntry) => void }) {
  if (!entries.length) return <Empty>Добавьте первый замер — кнопка «+ Замер» сверху.</Empty>;
  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const filled = METRICS.filter((m) => typeof e[m as keyof BodyEntry] === 'number');
        return (
          <Card key={e.id} onClick={() => onEdit(e)} className="space-y-1">
            <div className="flex justify-between">
              <span className="font-semibold">{formatRu(e.date, 'd MMMM yyyy')}</span>
              {e.weight != null && <span className="tabular">{formatNumber(e.weight)} кг</span>}
            </div>
            <div className="text-xs text-muted">
              {filled
                .filter((m) => m !== 'weight')
                .map((m) => `${BODY_LABEL[m]} ${formatNumber(e[m as keyof BodyEntry] as number)}`)
                .join(' · ') || 'только вес'}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function EntryForm({ initial, onDone }: { initial: BodyEntry; onDone: () => void }) {
  const [e, setE] = useState<BodyEntry>(initial);
  const exists = useLiveQuery(() => db.bodyEntries.get(initial.id), [initial.id]);
  const set = (m: BodyMetric, v: number | null) => setE({ ...e, [m]: v });
  return (
    <div className="space-y-3">
      <Field label="Дата">
        <input type="date" className={inputCls} value={e.date} onChange={(x) => setE({ ...e, date: x.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {METRICS.map((m) => (
          <Field key={m} label={`${BODY_LABEL[m]}, ${unitOf(m)}`}>
            <NumInput value={(e[m as keyof BodyEntry] as number | null | undefined) ?? null} onChange={(v) => set(m, v)} />
          </Field>
        ))}
      </div>
      <div className="text-xs text-muted">Все поля, кроме даты, необязательны.</div>
      <div className="grid grid-cols-2 gap-2">
        {exists ? (
          <Button
            variant="danger"
            onClick={async () => {
              if (confirm('Удалить замер?')) {
                await db.bodyEntries.delete(e.id);
                onDone();
              }
            }}
          >
            Удалить
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="primary"
          disabled={!e.date}
          onClick={async () => {
            await db.bodyEntries.put(e);
            onDone();
          }}
        >
          Сохранить
        </Button>
      </div>
    </div>
  );
}

function ChartsTab({ entries }: { entries: BodyEntry[] }) {
  const available = METRICS.filter((m) => entries.some((e) => typeof e[m as keyof BodyEntry] === 'number'));
  const [metric, setMetric] = useState<BodyMetric>(available[0] ?? 'weight');
  const data = useMemo(
    () =>
      [...entries]
        .filter((e) => typeof e[metric as keyof BodyEntry] === 'number')
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((e) => ({ date: e.date, label: formatRu(e.date, 'd.MM'), value: e[metric as keyof BodyEntry] as number })),
    [entries, metric],
  );
  if (!available.length) return <Empty>Пока нет данных для графиков</Empty>;
  const first = data[0]?.value;
  const last = data.at(-1)?.value;
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {available.map((m) => (
          <Chip key={m} active={metric === m} onClick={() => setMetric(m)}>
            {BODY_LABEL[m]}
          </Chip>
        ))}
      </div>
      <Card className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="font-semibold">{BODY_LABEL[metric]}</span>
          {first != null && last != null && data.length > 1 && (
            <span className="text-sm text-muted tabular">
              {formatNumber(last)} {unitOf(metric)} ({last - first >= 0 ? '+' : ''}
              {formatNumber(last - first)} за период)
            </span>
          )}
        </div>
        {data.length > 1 ? (
          <div className="h-56 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
                  contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.grid}`, borderRadius: 12 }}
                  labelStyle={{ color: '#e7eaf0' }}
                  itemStyle={{ color: '#e7eaf0' }}
                  labelFormatter={(_, p) => (p?.[0]?.payload ? formatRu(p[0].payload.date, 'd MMMM yyyy') : '')}
                  formatter={(v) => [`${formatNumber(Number(v))} ${unitOf(metric)}`, BODY_LABEL[metric]]}
                />
                <Line type="monotone" dataKey="value" stroke={CHART.series} strokeWidth={2} dot={{ r: 4, fill: CHART.series, strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-sm text-muted">Нужно хотя бы два замера.</div>
        )}
      </Card>
    </div>
  );
}

function CompareTab({ entries }: { entries: BodyEntry[] }) {
  const dates = [...new Set(entries.map((e) => e.date))].sort();
  const [a, setA] = useState(dates[0] ?? '');
  const [bDate, setB] = useState(dates.at(-1) ?? '');
  if (dates.length < 2) return <Empty>Для сравнения нужно минимум два замера.</Empty>;
  return (
    <Section>
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} value={a} onChange={(e) => setA(e.target.value)}>
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatRu(d, 'd MMM yyyy')}
            </option>
          ))}
        </select>
        <select className={inputCls} value={bDate} onChange={(e) => setB(e.target.value)}>
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatRu(d, 'd MMM yyyy')}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-2xl border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted">
            <tr>
              <th className="text-left font-normal px-3 py-2">Показатель</th>
              <th className="text-right font-normal px-2 py-2">А</th>
              <th className="text-right font-normal px-2 py-2">Б</th>
              <th className="text-right font-normal px-3 py-2">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface">
            {METRICS.map((m) => {
              const va = latestValue(entries, m, a)?.value;
              const vb = latestValue(entries, m, bDate)?.value;
              if (va == null && vb == null) return null;
              const d = va != null && vb != null ? vb - va : null;
              return (
                <tr key={m}>
                  <td className="px-3 py-2">{BODY_LABEL[m]}</td>
                  <td className="px-2 py-2 text-right tabular">{va != null ? formatNumber(va) : '—'}</td>
                  <td className="px-2 py-2 text-right tabular">{vb != null ? formatNumber(vb) : '—'}</td>
                  <td className={`px-3 py-2 text-right tabular ${d ? 'text-white' : 'text-muted'}`}>
                    {d == null ? '—' : `${d > 0 ? '+' : ''}${formatNumber(d)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-muted px-1">Если показатель не измерялся в выбранную дату, берётся последний замер до неё.</div>
    </Section>
  );
}
