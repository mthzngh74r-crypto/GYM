import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';

const LINKS = [
  { to: '/template', icon: '🔁', title: 'Шаблон цикла', sub: 'Дни и слоты упражнений' },
  { to: '/exercises', icon: '📚', title: 'База упражнений', sub: 'Поиск и свои упражнения' },
  { to: '/settings', icon: '⚙️', title: 'Настройки', sub: 'ИИ, оборудование, цель, бэкап' },
];

export function MorePage() {
  return (
    <div>
      <PageHeader title="Ещё" />
      <div className="p-4 space-y-3">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="flex items-center gap-4 rounded-2xl bg-surface border border-line p-4 active:bg-surface-2">
            <span className="text-3xl">{l.icon}</span>
            <span className="flex-1">
              <span className="block font-semibold text-lg">{l.title}</span>
              <span className="block text-sm text-muted">{l.sub}</span>
            </span>
            <span className="text-muted text-xl">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
