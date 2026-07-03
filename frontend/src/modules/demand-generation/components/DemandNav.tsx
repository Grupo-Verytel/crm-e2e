import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/demand', label: 'Leads', end: true },
  { to: '/demand/campaigns', label: 'Campañas', end: false },
  { to: '/demand/mqls', label: 'Bandeja MQL', end: false },
  { to: '/demand/dashboard', label: 'Dashboard', end: false },
];

export function DemandNav() {
  return (
    <nav className="mb-4 flex gap-1 border-b border-border">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            [
              '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
              isActive
                ? 'border-brand font-bold text-brand'
                : 'border-transparent text-muted hover:text-ink',
            ].join(' ')
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
