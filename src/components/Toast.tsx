import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Tone = 'info' | 'success' | 'error' | 'record';
interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
}

const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === 'record' ? 4000 : 3000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-safe">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-sm w-full rounded-xl px-4 py-3 shadow-lg border text-sm font-medium ${
              t.tone === 'record'
                ? 'bg-warn text-black border-warn text-base'
                : t.tone === 'error'
                  ? 'bg-danger/90 text-white border-danger'
                  : t.tone === 'success'
                    ? 'bg-accent text-black border-accent'
                    : 'bg-surface-2 text-white border-line'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
