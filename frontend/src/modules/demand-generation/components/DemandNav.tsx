import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';

const DIRECTOR_ROLE = 'DirectorMercadeo';

type NavItem = { to: string; label: string; end: boolean; directorOnly?: boolean };

const LINKS: NavItem[] = [
  { to: '/demand', label: 'Leads', end: true },
  { to: '/demand/campaigns', label: 'Campañas', end: false },
  // The Bandeja MQL is the Director's approval queue (business decision, not a
  // board drag), so it stays hidden from the Gestor de Mercadeo.
  { to: '/demand/mqls', label: 'Bandeja MQL', end: false, directorOnly: true },
  { to: '/demand/dashboard', label: 'Dashboard', end: false },
];

export function DemandNav() {
  const { user } = useAuth();
  const isDirector = user?.role_name === DIRECTOR_ROLE;
  const links = LINKS.filter((link) => !link.directorOnly || isDirector);

  return (
    <nav className="mb-4 flex gap-1 border-b border-border">
      {links.map((link) => (
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
