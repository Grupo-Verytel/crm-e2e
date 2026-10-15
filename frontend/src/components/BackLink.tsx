import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  to: string;
  children: ReactNode;
  className?: string;
};

/**
 * Enlace de regreso a la página padre: texto discreto que toma el acento al
 * pasar el mouse, con un chevron que se desplaza levemente hacia atrás.
 */
export function BackLink({ to, children, className = '' }: Props) {
  return (
    <Link
      to={to}
      className={`group -ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-bold text-muted transition-colors duration-200 ease-out hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${className}`}
    >
      <ChevronLeft
        size={16}
        strokeWidth={2.25}
        aria-hidden="true"
        className="transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
      />
      {children}
    </Link>
  );
}
