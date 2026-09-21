import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { isDirectorMercadeoRole } from '../../auth/lib/permission-catalog';

const DEVUELTAS_PARAM = 'bandeja';
const DEVUELTAS_VALUE = 'devueltas';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    isActive
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

/**
 * Module tabs on the Leads inbox and sibling trays (Campañas, MQL, Dashboard).
 * Hidden on lead detail. On "OUV devueltas" (reciclaje) only a back link.
 */
export function DemandNav({ trailing }: { trailing?: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const params = new URLSearchParams(location.search);
  const onDevueltas =
    location.pathname === '/demand' &&
    params.get(DEVUELTAS_PARAM) === DEVUELTAS_VALUE;
  const canSeeMqlInbox =
    user?.role_name === 'Admin' || isDirectorMercadeoRole(user?.role_name);

  if (onDevueltas) {
    return (
      <div className="mb-3">
        <Link
          to={{ pathname: '/demand', search: '' }}
          className="text-sm text-accent hover:underline"
        >
          ← Bandeja Leads
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-end justify-between gap-3 border-b border-border">
      <nav className="flex min-w-0 flex-wrap gap-1" aria-label="Leads">
        <NavLink to="/demand" end className={tabClass}>
          Leads
        </NavLink>
        <NavLink to="/demand/campaigns" end className={tabClass}>
          Campañas
        </NavLink>
        {canSeeMqlInbox ? (
          <NavLink to="/demand/mqls" className={tabClass}>
            Bandeja MQL
          </NavLink>
        ) : null}
        <NavLink to="/demand/dashboard" className={tabClass}>
          Dashboard
        </NavLink>
      </nav>
      {trailing}
    </div>
  );
}
