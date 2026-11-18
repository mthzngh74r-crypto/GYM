import { NumInput } from '../../components/NumInput';
import { Chip } from '../../components/ui';
import { unitLabel } from '../../domain/units';
import type { Units } from '../../domain/types';

export interface SetDraft {
  weight: number | null; // в выбранных единицах
  reps: number | null;
  rpe: number | null;
  isWarmup: boolean;
}

const RPE = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export function SetInput({
  draft,
  onChange,
  units,
  step,
}: {
  draft: SetDraft;
  onChange: (d: SetDraft) => void;
  units: Units;
  step: number;
}) {
  const w = draft.weight ?? 0;
  const r = draft.reps ?? 0;
  const round = (v: number) => Math.max(0, Math.round(v * 100) / 100);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stepper
          label={`Вес, ${unitLabel(units)}`}
          value={draft.weight}
          onChange={(v) => onChange({ ...draft, weight: v })}
          onMinus={() => onChange({ ...draft, weight: round(w - step) })}
          onPlus={() => onChange({ ...draft, weight: round(w + step) })}
          minusLabel={`−${String(step).replace('.', ',')}`}
          plusLabel={`+${String(step).replace('.', ',')}`}
        />
        <Stepper
          label="Повторы"
          value={draft.reps}
          onChange={(v) => onChange({ ...draft, reps: v == null ? null : Math.round(v) })}
          onMinus={() => onChange({ ...draft, reps: Math.max(0, r - 1) })}
          onPlus={() => onChange({ ...draft, reps: r + 1 })}
          minusLabel="−1"
          plusLabel="+1"
        />
      </div>
      <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <span className="text-xs text-muted shrink-0">RPE</span>
        {RPE.map((v) => (
          <Chip
            key={v}
            className="!h-9 !px-2.5 shrink-0"
            active={draft.rpe === v}
            onClick={() => onChange({ ...draft, rpe: draft.rpe === v ? null : v })}
          >
            {String(v).replace('.', ',')}
          </Chip>
        ))}
      </div>
      <Chip active={draft.isWarmup} onClick={() => onChange({ ...draft, isWarmup: !draft.isWarmup })}>
        {draft.isWarmup ? '✓ ' : ''}Разминочный подход
      </Chip>
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted text-center">{label}</div>
      <NumInput value={value} onChange={onChange} className="!h-14 text-center !text-2xl font-bold" />
      <div className="grid grid-cols-2 gap-1">
        <button onClick={onMinus} className="h-12 rounded-xl bg-surface-2 border border-line active:bg-line text-base tabular">
          {minusLabel}
        </button>
        <button onClick={onPlus} className="h-12 rounded-xl bg-surface-2 border border-line active:bg-line text-base tabular">
          {plusLabel}
        </button>
      </div>
    </div>
  );
}
