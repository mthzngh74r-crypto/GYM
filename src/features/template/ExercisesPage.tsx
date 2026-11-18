import { useState } from 'react';
import { PageHeader, Sheet, Button } from '../../components/ui';
import { ExercisePicker } from '../../components/ExercisePicker';
import { ExerciseForm } from '../../components/ExerciseForm';
import type { Exercise } from '../../domain/types';
import { db } from '../../db/schema';

export function ExercisesPage() {
  const [edit, setEdit] = useState<Exercise | null>(null);
  return (
    <div>
      <PageHeader title="База упражнений" />
      <div className="p-4">
        <ExercisePicker onPick={setEdit} />
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
