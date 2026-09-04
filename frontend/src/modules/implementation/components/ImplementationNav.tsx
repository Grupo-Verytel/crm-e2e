import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    isActive
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

export function ImplementationNav() {
  return (
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-border"
      aria-label="Implementación"
    >
      <NavLink to="/services" end className={linkClass}>
        Servicios (SER)
      </NavLink>
      <NavLink to="/services/reportes" className={linkClass}>
        Reportes de proyecto
      </NavLink>
    </nav>
  );
}
