import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { Button, Card, Chip, Empty, Field, Sheet, inputCls } from '../../components/ui';
import { formatRu, todayISO } from '../../domain/dates';
import { uid } from '../../domain/id';
import type { Photo, PhotoPose } from '../../domain/types';

const POSE_LABEL: Record<PhotoPose, string> = { front: 'Спереди', side: 'Сбоку', back: 'Сзади' };

/** Уменьшает фото до 1600 px по длинной стороне, чтобы не раздувать хранилище. */
async function downscale(file: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5e6) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

function useObjectUrl(blob?: Blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ''), [blob]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

function Thumb({ photo, onClick, selected }: { photo: Photo; onClick: () => void; selected?: boolean }) {
  const url = useObjectUrl(photo.blob);
  return (
    <button onClick={onClick} className={`relative aspect-[3/4] overflow-hidden rounded-xl border-2 ${selected ? 'border-accent' : 'border-transparent'}`}>
      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[11px] px-1 py-0.5">
        {formatRu(photo.date, 'd MMM yy')} · {POSE_LABEL[photo.pose]}
      </span>
    </button>
  );
}

export function PhotosTab() {
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), []) ?? [];
  const [mode, setMode] = useState<'grid' | 'compare'>('grid');
  const [pose, setPose] = useState<PhotoPose>('front');
  const [date, setDate] = useState(todayISO());
  const [view, setView] = useState<Photo | null>(null);
  const [pair, setPair] = useState<string[]>([]);

  const add = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      await db.photos.add({ id: uid(), date, pose, blob: await downscale(f) });
    }
  };

  const ofPose = photos.filter((p) => p.pose === pose);
  const before = photos.find((p) => p.id === pair[0]);
  const after = photos.find((p) => p.id === pair[1]);

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <div className="text-xs text-muted">Фото хранятся только на этом устройстве.</div>
        <div className="flex gap-2">
          {(Object.keys(POSE_LABEL) as PhotoPose[]).map((p) => (
            <Chip key={p} active={pose === p} onClick={() => setPose(p)}>
              {POSE_LABEL[p]}
            </Chip>
          ))}
        </div>
        <Field label="Дата снимка">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <label className="flex h-12 items-center justify-center rounded-xl bg-accent text-black font-semibold active:bg-accent-strong">
          📷 Добавить фото
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files).then(() => (e.target.value = ''))} />
        </label>
      </Card>

      <div className="flex gap-2">
        <Chip active={mode === 'grid'} onClick={() => setMode('grid')}>
          Все фото
        </Chip>
        <Chip active={mode === 'compare'} onClick={() => setMode('compare')}>
          До / после
        </Chip>
      </div>

      {mode === 'grid' &&
        (photos.length ? (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <Thumb key={p.id} photo={p} onClick={() => setView(p)} />
            ))}
          </div>
        ) : (
          <Empty>Фото пока нет</Empty>
        ))}

      {mode === 'compare' && (
        <div className="space-y-3">
          <div className="text-sm text-muted">
            Выберите два фото ракурса «{POSE_LABEL[pose]}»: сначала «до», потом «после».
          </div>
          {ofPose.length < 2 ? (
            <Empty>Нужно минимум два фото этого ракурса</Empty>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {ofPose.map((p) => (
                <Thumb
                  key={p.id}
                  photo={p}
                  selected={pair.includes(p.id)}
                  onClick={() => setPair((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id].slice(-2)))}
                />
              ))}
            </div>
          )}
          {before && after && <BeforeAfter a={before.date <= after.date ? before : after} b={before.date <= after.date ? after : before} />}
        </div>
      )}

      <Sheet open={!!view} onClose={() => setView(null)} title={view ? `${formatRu(view.date, 'd MMMM yyyy')} · ${POSE_LABEL[view.pose]}` : ''}>
        {view && <FullPhoto photo={view} onDeleted={() => setView(null)} />}
      </Sheet>
    </div>
  );
}

function FullPhoto({ photo, onDeleted }: { photo: Photo; onDeleted: () => void }) {
  const url = useObjectUrl(photo.blob);
  return (
    <>
      <img src={url} alt="" className="w-full rounded-xl" />
      <Button
        variant="danger"
        className="w-full"
        onClick={async () => {
          if (confirm('Удалить фото?')) {
            await db.photos.delete(photo.id);
            onDeleted();
          }
        }}
      >
        Удалить фото
      </Button>
    </>
  );
}

function BeforeAfter({ a, b }: { a: Photo; b: Photo }) {
  const ua = useObjectUrl(a.blob);
  const ub = useObjectUrl(b.blob);
  const [pos, setPos] = useState(50);
  return (
    <Card className="!p-2 space-y-2">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl select-none">
        <img src={ub} alt="после" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <img src={ua} alt="до" className="absolute inset-0 h-full object-cover" style={{ width: `${10000 / Math.max(pos, 1)}%`, maxWidth: 'none' }} />
        </div>
        <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${pos}%` }} />
        <span className="absolute top-2 left-2 rounded bg-black/60 px-2 text-xs">До · {formatRu(a.date, 'd MMM yy')}</span>
        <span className="absolute top-2 right-2 rounded bg-black/60 px-2 text-xs">После · {formatRu(b.date, 'd MMM yy')}</span>
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="w-full accent-[#4ade80]" aria-label="Положение разделителя" />
    </Card>
  );
}
