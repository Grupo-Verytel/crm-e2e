import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    isActive
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

export function DiscoveryNav() {
  return (
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-border"
      aria-label="Oportunidades"
    >
      <NavLink to="/opportunities" end className={linkClass}>
        Bandeja OUV
      </NavLink>
      <NavLink to="/opportunities/perdidas" className={linkClass}>
        Oportunidades perdidas
      </NavLink>
      <NavLink to="/opportunities/descartadas" className={linkClass}>
        Oportunidades descartadas
      </NavLink>
    </nav>
  );
}
