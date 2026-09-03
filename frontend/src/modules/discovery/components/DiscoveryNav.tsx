import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    isActive
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

export function DiscoveryNav() {
  const { user } = useAuth();
  const isSoporte =
    user?.role_name === 'SoporteComercial' || user?.role_name === 'Admin';

  return (
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-border"
      aria-label="Oportunidades"
    >
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
