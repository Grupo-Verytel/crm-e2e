import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { hasPermission } from '../../auth/lib/permission-catalog';

const tabClass = (isActive: boolean) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    isActive
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

const navLinkClass = ({ isActive }: { isActive: boolean }) => tabClass(isActive);

function assignedTray(
  pathname: string,
  search: string,
): 'nuevos' | 'convertidos' | null {
  if (pathname !== '/qualification/assigned') {
    return null;
  }
  return new URLSearchParams(search).get('bandeja') === 'convertidos'
    ? 'convertidos'
    : 'nuevos';
}

export function QualificationNav() {
  const { user } = useAuth();
  const location = useLocation();
  const canAssign =
    user?.role_name === 'Admin' ||
    hasPermission(user?.permissions, 'assign', 'Sql');
  const canCreateOuv =
    user?.role_name === 'Admin' ||
    hasPermission(user?.permissions, 'create', 'Sql');
  const canSeeConverted = canCreateOuv;
  const tray = assignedTray(location.pathname, location.search);

  return (
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-border"
      aria-label="Calificación"
    >
      {canAssign ? (
        <NavLink to="/qualification" end className={navLinkClass}>
          Me llegaron
        </NavLink>
      ) : null}
      {canCreateOuv && !canAssign ? (
        <Link
          to="/qualification/assigned"
          className={tabClass(tray === 'nuevos')}
          aria-current={tray === 'nuevos' ? 'page' : undefined}
        >
          Me llegaron
        </Link>
      ) : null}
      {canSeeConverted ? (
        <Link
          to="/qualification/assigned?bandeja=convertidos"
          className={tabClass(tray === 'convertidos')}
          aria-current={tray === 'convertidos' ? 'page' : undefined}
        >
          Convertidos a OUV
        </Link>
      ) : null}
    </nav>
  );
}
