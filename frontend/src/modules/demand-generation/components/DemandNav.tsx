import { Link, NavLink, useLocation } from 'react-router-dom';

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
export function DemandNav() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const onDevueltas =
    location.pathname === '/demand' &&
    params.get(DEVUELTAS_PARAM) === DEVUELTAS_VALUE;

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
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-border"
      aria-label="Leads"
    >
      <NavLink to="/demand" end className={tabClass}>
        Leads
      </NavLink>
      <NavLink to="/demand/campaigns" end className={tabClass}>
        Campañas
      </NavLink>
      <NavLink to="/demand/mqls" className={tabClass}>
        Bandeja MQL
      </NavLink>
      <NavLink to="/demand/dashboard" className={tabClass}>
        Dashboard
      </NavLink>
    </nav>
  );
}
