import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/', label: 'Сегодня', icon: '🏋️', end: true },
  { to: '/calendar', label: 'Календарь', icon: '📅' },
  { to: '/progress', label: 'Прогресс', icon: '📈' },
  { to: '/body', label: 'Тело', icon: '📏' },
  { to: '/more', label: 'Ещё', icon: '⚙️' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line pb-safe">
      <div className="mx-auto max-w-xl grid grid-cols-5">
        {ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center h-16 gap-0.5 text-[11px] ${isActive ? 'text-accent' : 'text-muted'}`
            }
          >
            <span className="text-2xl leading-none">{it.icon}</span>
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
