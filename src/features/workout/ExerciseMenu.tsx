import { useState } from 'react';
import { Button, Field, Sheet, inputCls } from '../../components/ui';
import { NumInput } from '../../components/NumInput';
import { ExercisePicker } from '../../components/ExercisePicker';
import type { Exercise, Settings, SlotGroup, WorkoutExercise } from '../../domain/types';
import { removeWorkoutExercise, swapExercise, updateWorkoutExercise } from '../../db/repo';
import { kgToUnit, unitLabel, unitToKg } from '../../domain/units';
import { useToast } from '../../components/Toast';

type Mode = 'menu' | 'swap' | 'edit' | 'note';

export function ExerciseMenu({
  we,
  exercise,
  slotGroup,
  settings,
  excludeIds,
  onClose,
  onSuggest,
  onMove,
}: {
  we: WorkoutExercise | null;
  exercise?: Exercise;
  slotGroup?: SlotGroup;
  settings: Settings;
  excludeIds: string[];
  onClose: () => void;
  onSuggest: (we: WorkoutExercise) => Promise<void>;
  onMove: (we: WorkoutExercise, dir: -1 | 1) => void;
}) {
  const [mode, setMode] = useState<Mode>('menu');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const close = () => {
    setMode('menu');
    onClose();
  };
  if (!we) return null;
  const aiReady = settings.aiEnabled && !!settings.apiKey;

  return (
    <Sheet open={!!we} onClose={close} title={mode === 'swap' ? 'Заменить на…' : exercise?.name}>
      {mode === 'menu' && (
        <div className="grid gap-2">
          <Button onClick={() => setMode('swap')}>🔄 Заменить вручную</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSuggest(we);
                close();
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Не удалось подобрать замену', 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Подбираю…' : aiReady ? '✨ Предложи другое (ИИ)' : '🎲 Предложи другое'}
          </Button>
          <Button onClick={() => setMode('edit')}>🎯 Изменить цель</Button>
          <Button onClick={() => setMode('note')}>📝 Заметка к упражнению</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onMove(we, -1)}>↑ Выше</Button>
            <Button onClick={() => onMove(we, 1)}>↓ Ниже</Button>
          </div>
          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm('Убрать упражнение из тренировки вместе с подходами?')) return;
              await removeWorkoutExercise(we.id);
              close();
            }}
          >
            Убрать из тренировки
          </Button>
        </div>
      )}
      {mode === 'swap' && (
        <ExercisePicker
          group={slotGroup}
          excludeIds={excludeIds}
          onPick={async (ex) => {
            await swapExercise(we.id, ex.id, { aiNote: '' });
            toast(`Заменено на «${ex.name}»`, 'success');
            close();
          }}
        />
      )}
      {mode === 'edit' && <TargetEditor we={we} settings={settings} onDone={close} />}
      {mode === 'note' && <NoteEditor we={we} onDone={close} />}
    </Sheet>
  );
}

function TargetEditor({ we, settings, onDone }: { we: WorkoutExercise; settings: Settings; onDone: () => void }) {
  const [v, setV] = useState({
    targetSets: we.targetSets,
    repMin: we.repMin,
    repMax: we.repMax,
    restSec: we.restSec,
    weight: we.targetWeight == null ? null : Math.round(kgToUnit(we.targetWeight, settings.units) * 100) / 100,
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Подходы">
          <NumInput value={v.targetSets} onChange={(x) => x && setV({ ...v, targetSets: Math.round(x) })} />
        </Field>
        <Field label="Повт. от">
          <NumInput value={v.repMin} onChange={(x) => x && setV({ ...v, repMin: Math.round(x) })} />
        </Field>
        <Field label="до">
          <NumInput value={v.repMax} onChange={(x) => x && setV({ ...v, repMax: Math.round(x) })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`Вес, ${unitLabel(settings.units)}`}>
          <NumInput value={v.weight} onChange={(x) => setV({ ...v, weight: x })} />
        </Field>
        <Field label="Отдых, сек">
          <NumInput value={v.restSec} onChange={(x) => x && setV({ ...v, restSec: Math.round(x) })} />
        </Field>
      </div>
      <Button
        variant="primary"
        className="w-full"
        onClick={async () => {
          await updateWorkoutExercise(we.id, {
            targetSets: v.targetSets,
            repMin: Math.min(v.repMin, v.repMax),
            repMax: Math.max(v.repMin, v.repMax),
            restSec: v.restSec,
            targetWeight: v.weight == null ? null : unitToKg(v.weight, settings.units),
          });
          onDone();
        }}
      >
        Сохранить
      </Button>
    </div>
  );
}

function NoteEditor({ we, onDone }: { we: WorkoutExercise; onDone: () => void }) {
  const [text, setText] = useState(we.notes);
  return (
    <div className="space-y-3">
      <textarea
        autoFocus
        className={`${inputCls} h-32 py-2`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Например: тянуло плечо на последнем подходе"
      />
      <Button
        variant="primary"
        className="w-full"
        onClick={async () => {
          await updateWorkoutExercise(we.id, { notes: text.trim() });
          onDone();
        }}
      >
        Сохранить
      </Button>
    </div>
  );
}
