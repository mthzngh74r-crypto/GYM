import { formatSec } from '../hooks/useRestTimer';

export function RestTimerBar({
  running,
  remaining,
  total,
  label,
  onAdd,
  onStop,
}: {
  running: boolean;
  remaining: number;
  total: number;
  label: string;
  onAdd: (d: number) => void;
  onStop: () => void;
}) {
  if (!running) return null;
  const pct = total ? Math.min(100, ((total - remaining) / total) * 100) : 0;
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface border-t border-line">
      <div className="h-1 bg-line">
        <div className="h-1 bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mx-auto max-w-xl flex items-center gap-2 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted truncate">Отдых{label ? ` · ${label}` : ''}</div>
          <div className="text-3xl font-bold tabular">{formatSec(remaining)}</div>
        </div>
        <button className="h-12 w-14 rounded-xl bg-surface-2 border border-line" onClick={() => onAdd(-15)}>
          −15
        </button>
        <button className="h-12 w-14 rounded-xl bg-surface-2 border border-line" onClick={() => onAdd(30)}>
          +30
        </button>
        <button className="h-12 px-4 rounded-xl bg-accent text-black font-semibold" onClick={onStop}>
          Готов
        </button>
      </div>
    </div>
  );
}
