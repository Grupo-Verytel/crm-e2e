import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded px-3 py-1.5 text-sm',
    isActive ? 'bg-brand text-white font-bold' : 'text-ink hover:bg-bg',
  ].join(' ');

export function DiscoveryNav() {
  const { user } = useAuth();
  const isSoporte =
    user?.role_name === 'SoporteComercial' || user?.role_name === 'Admin';

  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Oportunidades">
      <NavLink to="/opportunities" end className={linkClass}>
        Bandeja OUV
      </NavLink>
      {isSoporte ? (
        <>
          <NavLink
            to="/opportunities/admin/motivos-perdida"
            className={linkClass}
          >
            Motivos pérdida
          </NavLink>
          <NavLink
            to="/opportunities/admin/motivos-descarte"
            className={linkClass}
          >
            Motivos descarte
          </NavLink>
          <NavLink
            to="/opportunities/admin/zona-checklist-templates"
            className={linkClass}
          >
            Checklist zonas
          </NavLink>
        </>
      ) : null}
    </nav>
  );
}
