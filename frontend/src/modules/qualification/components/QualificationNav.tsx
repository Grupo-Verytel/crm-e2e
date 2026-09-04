import { NavLink } from 'react-router-dom';
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
  const isInboxViewer =
    user?.role_name === 'SoporteComercial' ||
    user?.role_name === 'Admin' ||
    user?.role_name === 'DirectorMercadeo';
  const isEjecutivo =
    user?.role_name === 'EjecutivoComercial' || user?.role_name === 'Admin';
  const isDirector = user?.role_name === 'DirectorMercadeo';

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
      {isEjecutivo || isDirector ? (
        <NavLink to="/qualification/assigned" className={linkClass}>
          {isDirector ? 'SQL asignados' : 'Mis SQL'}
        </NavLink>
      ) : null}
    </nav>
  );
}
