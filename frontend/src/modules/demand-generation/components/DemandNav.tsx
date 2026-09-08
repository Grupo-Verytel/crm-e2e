import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';

const SUPPORT_ROLE = 'SoporteComercial';
const GESTOR_ROLE = 'GestorMercadeo';
const PRODUCT_MANAGER_ROLE = 'ProductManager';
const TRADUCTOR_ROLE = 'TraductorDeNegocio';

/** Roles that can open Bandeja de Agenda / register agency citas (MOFU → BOFU). */
const AGENDA_ROLES = new Set([SUPPORT_ROLE, GESTOR_ROLE, 'Admin']);

type NavItem = {
  to: string;
  label: string;
  end: boolean;
  agendaOnly?: boolean;
};

const LINKS: NavItem[] = [
  { to: '/demand', label: 'Leads', end: true },
  { to: '/demand/campaigns', label: 'Campañas', end: false },
  { to: '/demand/mqls', label: 'Bandeja MQL', end: false },
  {
    to: '/demand/agenda',
    label: 'Bandeja de Agenda',
    end: false,
    agendaOnly: true,
  },
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
  const canUseAgenda = !!roleName && AGENDA_ROLES.has(roleName);

  let links: NavItem[];
  if (isTraductor) {
    links = [{ to: '/demand', label: 'Mis referidos', end: true }];
  } else if (isProductManager) {
    links = [{ to: '/demand', label: 'Leads', end: true }];
  } else {
    links = LINKS.filter((link) => !link.agendaOnly || canUseAgenda);
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
