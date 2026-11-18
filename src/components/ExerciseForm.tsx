import { useState } from 'react';
import { Button, Chip, Field, inputCls } from './ui';
import { ALL_EQUIPMENT, EQUIPMENT_LABEL, MUSCLE_GROUPS, MUSCLE_LABEL } from '../domain/muscles';
import type { Equipment, Exercise, ExerciseKind, MuscleGroup } from '../domain/types';
import { db } from '../db/schema';
import { uid } from '../domain/id';

export function ExerciseForm({
  initial,
  defaultGroup,
  onSaved,
}: {
  initial?: Exercise;
  defaultGroup?: MuscleGroup;
  onSaved: (ex: Exercise) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [group, setGroup] = useState<MuscleGroup>(initial?.muscleGroup ?? defaultGroup ?? 'chest');
  const [kind, setKind] = useState<ExerciseKind>(initial?.kind ?? 'isolation');
  const [eq, setEq] = useState<Equipment[]>(initial?.equipment ?? []);

  const save = async () => {
    const ex: Exercise = {
      id: initial?.id ?? `custom_${uid()}`,
      name: name.trim(),
      muscleGroup: group,
      kind,
      equipment: eq,
      isCustom: initial?.isCustom ?? true,
      secondary: initial?.secondary,
      fromAi: initial?.fromAi,
    };
    await db.exercises.put(ex);
    onSaved(ex);
  };

  return (
    <div className="space-y-3">
      <Field label="Название">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, жим Ландмайн" />
      </Field>
      <Field label="Группа мышц">
        <select className={inputCls} value={group} onChange={(e) => setGroup(e.target.value as MuscleGroup)}>
          {MUSCLE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {MUSCLE_LABEL[g]}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex gap-2">
        <Chip active={kind === 'compound'} onClick={() => setKind('compound')}>
          Базовое
        </Chip>
        <Chip active={kind === 'isolation'} onClick={() => setKind('isolation')}>
          Изолирующее
        </Chip>
      </div>
      <div className="text-sm text-muted">Оборудование</div>
      <div className="flex flex-wrap gap-2">
        {ALL_EQUIPMENT.map((e) => (
          <Chip key={e} active={eq.includes(e)} onClick={() => setEq(eq.includes(e) ? eq.filter((x) => x !== e) : [...eq, e])}>
            {EQUIPMENT_LABEL[e]}
          </Chip>
        ))}
      </div>
      <Button variant="primary" className="w-full" disabled={name.trim().length < 2} onClick={save}>
        Сохранить
      </Button>
    </div>
  );
}
