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

function isAssignedTray(pathname: string): boolean {
  return pathname === '/qualification/assigned';
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
  const assignedActive = isAssignedTray(location.pathname);

  return (
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-border"
      aria-label="Calificación"
    >
      {canAssign ? (
        <>
          <NavLink to="/qualification" end className={navLinkClass}>
            Enrutamiento
          </NavLink>
          <NavLink to="/qualification/assigned-sqls" className={navLinkClass}>
            SQL asignados
          </NavLink>
        </>
      ) : null}
      {canCreateOuv && !canAssign ? (
        <Link
          to="/qualification/assigned"
          className={tabClass(assignedActive)}
          aria-current={assignedActive ? 'page' : undefined}
        >
          Me llegaron
        </Link>
      ) : null}
    </nav>
  );
}
