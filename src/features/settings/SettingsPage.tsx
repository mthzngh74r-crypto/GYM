import { useState } from 'react';
import { Button, Card, Chip, Field, PageHeader, Section, Toggle, inputCls } from '../../components/ui';
import { NumInput } from '../../components/NumInput';
import { updateSettings, useSettings } from '../../hooks/useSettings';
import { ALL_EQUIPMENT, EQUIPMENT_LABEL, GOAL_LABEL } from '../../domain/muscles';
import { MODEL_OPTIONS } from '../../db/defaults';
import type { Goal, Settings } from '../../domain/types';
import { BackupSection } from './BackupSection';
import { ApiKeyCheck } from './ApiKeyCheck';

export function SettingsPage() {
  const s = useSettings();
  const [showKey, setShowKey] = useState(false);
  const set = (patch: Partial<Settings>) => updateSettings(patch);
  const customModel = !MODEL_OPTIONS.some((m) => m.id === s.model);

  return (
    <div>
      <PageHeader title="Настройки" />
      <div className="p-4 space-y-6 max-w-xl mx-auto">
        <Section title="ИИ (Claude)">
          <Card className="space-y-3">
            <Toggle checked={s.aiEnabled} onChange={(v) => set({ aiEnabled: v })} label="Подбирать упражнения с помощью ИИ" />
            <Field
              label="API-ключ Anthropic"
              hint="Хранится только на этом устройстве. Лучше создать отдельный ключ с лимитом расходов."
            >
              <div className="flex gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  className={inputCls}
                  placeholder="sk-ant-..."
                  value={s.apiKey}
                  onChange={(e) => set({ apiKey: e.target.value.trim() })}
                />
                <Button onClick={() => setShowKey((v) => !v)} aria-label="Показать ключ">
                  {showKey ? '🙈' : '👁'}
                </Button>
              </div>
            </Field>
            <Field label="Модель">
              <select
                className={inputCls}
                value={customModel ? '__custom' : s.model}
                onChange={(e) => set({ model: e.target.value === '__custom' ? '' : e.target.value })}
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
                <option value="__custom">Другая (ввести ID)…</option>
              </select>
            </Field>
            {customModel && (
              <input className={inputCls} placeholder="claude-..." value={s.model} onChange={(e) => set({ model: e.target.value.trim() })} />
            )}
            <Field label="Глубина размышлений" hint="Чем выше, тем дольше и дороже ответ.">
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((e) => (
                  <Chip key={e} active={s.aiEffort === e} onClick={() => set({ aiEffort: e })}>
                    {{ low: 'Низкая', medium: 'Средняя', high: 'Высокая' }[e]}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="История для ИИ, недель">
              <NumInput value={s.historyWeeks} onChange={(v) => v && set({ historyWeeks: Math.min(12, Math.max(2, Math.round(v))) })} allowEmpty={false} />
            </Field>
            <ApiKeyCheck />
          </Card>
        </Section>

        <Section title="Цель и ограничения">
          <Card className="space-y-3">
            <div className="flex gap-2">
              {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
                <Chip key={g} active={s.goal === g} onClick={() => set({ goal: g })}>
                  {GOAL_LABEL[g]}
                </Chip>
              ))}
            </div>
            <Field label="Ограничения и травмы" hint="Например: «болит плечо, без жима из-за головы»">
              <textarea
                className={`${inputCls} h-24 py-2`}
                value={s.limitations}
                onChange={(e) => set({ limitations: e.target.value })}
              />
            </Field>
          </Card>
        </Section>

        <Section title="Оборудование">
          <Card>
            <div className="flex flex-wrap gap-2">
              {ALL_EQUIPMENT.map((eq) => {
                const on = s.equipment.includes(eq);
                return (
                  <Chip
                    key={eq}
                    active={on}
                    onClick={() => set({ equipment: on ? s.equipment.filter((x) => x !== eq) : [...s.equipment, eq] })}
                  >
                    {EQUIPMENT_LABEL[eq]}
                  </Chip>
                );
              })}
            </div>
          </Card>
        </Section>

        <Section title="Повторения и отдых">
          <Card className="space-y-3">
            <RangeRow
              label="Базовые: повторы"
              value={s.repRanges.compound}
              onChange={(v) => set({ repRanges: { ...s.repRanges, compound: v } })}
            />
            <RangeRow
              label="Изолирующие: повторы"
              value={s.repRanges.isolation}
              onChange={(v) => set({ repRanges: { ...s.repRanges, isolation: v } })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Отдых базовые, сек">
                <NumInput value={s.restSec.compound} onChange={(v) => v && set({ restSec: { ...s.restSec, compound: Math.round(v) } })} allowEmpty={false} />
              </Field>
              <Field label="Отдых изоляция, сек">
                <NumInput value={s.restSec.isolation} onChange={(v) => v && set({ restSec: { ...s.restSec, isolation: Math.round(v) } })} allowEmpty={false} />
              </Field>
            </div>
          </Card>
        </Section>

        <Section title="Единицы и профиль">
          <Card className="space-y-3">
            <div className="flex gap-2">
              <Chip active={s.units === 'kg'} onClick={() => set({ units: 'kg', weightStep: s.units === 'kg' ? s.weightStep : 2.5 })}>
                Килограммы
              </Chip>
              <Chip active={s.units === 'lb'} onClick={() => set({ units: 'lb', weightStep: s.units === 'lb' ? s.weightStep : 5 })}>
                Фунты
              </Chip>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Шаг веса, ${s.units === 'kg' ? 'кг' : 'lb'}`}>
                <NumInput value={s.weightStep} onChange={(v) => v && v > 0 && set({ weightStep: v })} allowEmpty={false} />
              </Field>
              <Field label="Рост, см">
                <NumInput value={s.heightCm} onChange={(v) => set({ heightCm: v })} />
              </Field>
            </div>
          </Card>
        </Section>

        <Section title="Таймер отдыха">
          <Card>
            <Toggle checked={s.timerSound} onChange={(v) => set({ timerSound: v })} label="Звук в конце" />
            <Toggle checked={s.timerVibration} onChange={(v) => set({ timerVibration: v })} label="Вибрация (Android)" />
          </Card>
        </Section>

        <BackupSection />
      </div>
    </div>
  );
}

function RangeRow({ label, value, onChange }: { label: string; value: [number, number]; onChange: (v: [number, number]) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <NumInput value={value[0]} onChange={(v) => v && onChange([Math.round(v), Math.max(value[1], Math.round(v))])} allowEmpty={false} />
        <span className="text-muted">–</span>
        <NumInput value={value[1]} onChange={(v) => v && onChange([value[0], Math.round(v)])} allowEmpty={false} />
      </div>
    </Field>
  );
}
