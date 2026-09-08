import { NavLink } from 'react-router-dom';
import { isRoleName } from '../../../lib/roles';
import { useAuth } from '../../auth/hooks/useAuth';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    isActive
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

export function QualificationNav() {
  const { user } = useAuth();
  const isInboxViewer = isRoleName(
    user?.role_name,
    'SoporteComercial',
    'Admin',
    'DirectorMercadeo',
  );
  const seesAllAssigned = isRoleName(
    user?.role_name,
    'DirectorMercadeo',
    'SoporteComercial',
    'Admin',
    'GestorMercadeo',
  );

  return (
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-border"
      aria-label="Calificación"
    >
      {isInboxViewer ? (
        <NavLink to="/qualification" end className={linkClass}>
          Enrutamiento
        </NavLink>
      ) : null}
      <NavLink to="/qualification/assigned" className={linkClass}>
        {seesAllAssigned ? 'SQL asignados' : 'Mis SQL'}
      </NavLink>
    </nav>
  );
}
