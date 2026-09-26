import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { isRoleName } from '../../../lib/roles';
import { useAuth } from '../../auth/hooks/useAuth';

const GESTOR_ROLE = 'GestorMercadeo';
const PRODUCT_MANAGER_ROLE = 'ProductManager';
const TRADUCTOR_ROLE = 'TraductorDeNegocio';

/** Bandeja MQL is the Director's approval tray. Gestor de Mercadeo does not open it. */
export function canOpenMqlInbox(roleName: string | undefined): boolean {
  return !isRoleName(roleName, GESTOR_ROLE);
}

type NavItem = {
  to: string;
  label: string;
  end: boolean;
  mqlInbox?: boolean;
};

const LINKS: NavItem[] = [
  { to: '/demand', label: 'Leads', end: true },
  { to: '/demand/campaigns', label: 'Campañas', end: false },
  { to: '/demand/mqls', label: 'Bandeja MQL', end: false, mqlInbox: true },
  { to: '/demand/dashboard', label: 'Dashboard', end: false },
];

type DemandNavProps = {
  actions?: ReactNode;
};

export function DemandNav({ actions }: DemandNavProps) {
  const { user } = useAuth();
  const roleName = user?.role_name;
  const isTraductor = roleName === TRADUCTOR_ROLE;
  const isProductManager = roleName === PRODUCT_MANAGER_ROLE;
  const showMqlInbox = canOpenMqlInbox(roleName);

  let links: NavItem[];
  if (isTraductor) {
    links = [{ to: '/demand', label: 'Mis referidos', end: true }];
  } else if (isProductManager) {
    links = [{ to: '/demand', label: 'Leads', end: true }];
  } else {
    links = LINKS.filter((link) => !link.mqlInbox || showMqlInbox);
  }

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
                  ? 'border-accent font-bold text-accent'
                  : 'border-transparent text-muted hover:text-accent',
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
