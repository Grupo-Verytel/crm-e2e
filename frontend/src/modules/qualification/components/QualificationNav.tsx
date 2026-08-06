import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded px-3 py-1.5 text-sm',
    isActive ? 'bg-brand text-white font-bold' : 'text-ink hover:bg-bg',
  ].join(' ');

export function QualificationNav() {
  const { user } = useAuth();
  const isSoporte =
    user?.role_name === 'SoporteComercial' || user?.role_name === 'Admin';
  const isEjecutivo =
    user?.role_name === 'EjecutivoComercial' || user?.role_name === 'Admin';

  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Calificación">
      {isSoporte ? (
        <NavLink to="/qualification" end className={linkClass}>
          Enrutamiento
        </NavLink>
      ) : null}
      {isEjecutivo ? (
        <NavLink to="/qualification/assigned" className={linkClass}>
          Mis SQL
        </NavLink>
      ) : null}
    </nav>
  );
}
