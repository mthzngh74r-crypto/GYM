import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader, Sheet, Button } from '../../components/ui';
import { ExercisePicker } from '../../components/ExercisePicker';
import { ExerciseForm } from '../../components/ExerciseForm';
import type { Exercise } from '../../domain/types';
import { db } from '../../db/schema';

export function ExercisesPage() {
  const [edit, setEdit] = useState<Exercise | null>(null);
  const hidden = useLiveQuery(() => db.exercises.filter((e) => !!e.archived).toArray(), []) ?? [];
  return (
    <div>
      <PageHeader title="База упражнений" />
      <div className="p-4">
        <ExercisePicker onPick={setEdit} />
        {hidden.length > 0 && (
          <details className="mt-6">
            <summary className="text-sm text-muted py-2">Скрытые упражнения ({hidden.length})</summary>
            <div className="space-y-2 mt-2">
              {hidden.map((e) => (
                <div key={e.id} className="flex items-center gap-2 rounded-xl bg-surface border border-line px-3 py-2">
                  <span className="flex-1">{e.name}</span>
                  <Button size="sm" onClick={() => db.exercises.update(e.id, { archived: false })}>
                    Вернуть
                  </Button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name}>
        {edit && (
          <>
            <ExerciseForm key={edit.id} initial={edit} onSaved={() => setEdit(null)} />
            <Button
              variant="danger"
              className="w-full"
              onClick={async () => {
                const used = await db.sets.where('exerciseId').equals(edit.id).count();
                if (used > 0 || !edit.isCustom) await db.exercises.update(edit.id, { archived: true });
                else await db.exercises.delete(edit.id);
                setEdit(null);
              }}
            >
              {edit.isCustom ? 'Удалить' : 'Скрыть из базы'}
            </Button>
          </>
        )}
      </Sheet>
    </div>
  );
}
