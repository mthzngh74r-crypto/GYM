import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-black active:bg-accent-strong font-semibold',
  secondary: 'bg-surface-2 text-white active:bg-line border border-line',
  ghost: 'bg-transparent text-white active:bg-surface-2',
  danger: 'bg-danger/15 text-danger border border-danger/40 active:bg-danger/25',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'h-14 px-5 text-lg' : size === 'sm' ? 'h-9 px-3 text-sm' : 'h-12 px-4';
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl select-none transition-colors disabled:opacity-40 ${sz} ${VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-2xl bg-surface border border-line p-4 ${onClick ? 'active:bg-surface-2 cursor-pointer' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, right, sub }: { title: string; right?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-line">
      <div className="flex items-center gap-3 px-4 h-14">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{title}</h1>
          {sub && <div className="text-xs text-muted truncate -mt-0.5">{sub}</div>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Section({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="space-y-2">
      {(title || right) && (
        <div className="flex items-center justify-between px-1">
          {title && <h2 className="text-sm uppercase tracking-wide text-muted">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full h-12 rounded-xl bg-surface-2 border border-line px-3 text-white placeholder:text-muted/70 focus:outline-none focus:border-accent';

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 min-h-12 py-2 text-left"
    >
      <span>{label}</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

export function Chip({ active, children, onClick, className = '' }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 px-3 rounded-full border text-sm whitespace-nowrap ${active ? 'bg-accent/20 border-accent text-accent' : 'bg-surface-2 border-line text-white'} ${className}`}
    >
      {children}
    </button>
  );
}

/** Нижняя шторка. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-h-[88vh] overflow-y-auto rounded-t-3xl bg-surface border-t border-line pb-safe">
        <div className="sticky top-0 z-10 bg-surface flex items-center justify-between px-4 pt-3 pb-2">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} className="h-10 w-10 rounded-full text-2xl text-muted active:bg-surface-2" aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="px-4 pb-6 space-y-3">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-center text-muted py-10 px-6">{children}</div>;
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'warn' | 'danger' | 'info' }) {
  const cls = {
    muted: 'bg-surface-2 text-muted',
    accent: 'bg-accent/15 text-accent',
    warn: 'bg-warn/15 text-warn',
    danger: 'bg-danger/15 text-danger',
    info: 'bg-info/15 text-info',
  }[tone];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}
