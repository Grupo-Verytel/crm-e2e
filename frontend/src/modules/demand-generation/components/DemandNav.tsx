import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';

const DIRECTOR_ROLE = 'DirectorMercadeo';
const SUPPORT_ROLE = 'SoporteComercial';

type NavItem = {
  to: string;
  label: string;
  end: boolean;
  directorOnly?: boolean;
  supportOnly?: boolean;
};

const LINKS: NavItem[] = [
  { to: '/demand', label: 'Leads', end: true },
  { to: '/demand/campaigns', label: 'Campañas', end: false },
  // The Bandeja MQL is the Director's approval queue (business decision, not a
  // board drag), so it stays hidden from the Gestor de Mercadeo.
  { to: '/demand/mqls', label: 'Bandeja MQL', end: false, directorOnly: true },
  {
    to: '/demand/agenda',
    label: 'Bandeja de Agenda',
    end: false,
    supportOnly: true,
  },
  { to: '/demand/dashboard', label: 'Dashboard', end: false },
];

type DemandNavProps = {
  actions?: ReactNode;
};

export function DemandNav({ actions }: DemandNavProps) {
  const { user } = useAuth();
  const isDirector = user?.role_name === DIRECTOR_ROLE;
  const isSupport = user?.role_name === SUPPORT_ROLE;
  const links = LINKS.filter(
    (link) =>
      (!link.directorOnly || isDirector) && (!link.supportOnly || isSupport),
  );

  return (
    <div className="mb-4 flex flex-wrap items-start gap-2 border-b border-border">
      <nav className="flex gap-1">
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
      {actions ? <div className="ml-auto">{actions}</div> : null}
    </div>
  );
}
