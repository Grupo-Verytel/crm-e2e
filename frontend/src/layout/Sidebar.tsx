import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { canAccessNavItem, NAV_ITEMS, type NavItem } from '../lib/navigation';
import { useAuth } from '../modules/auth/hooks/useAuth';
import { BrandMark } from './BrandMark';

/**
 * Minimalist Verytel sidebar. White surface, hairline divider, brand-primary active state.
 * Density and structure follow a Pipedrive-like work tool: icons + labels, no decoration.
 * Only modules the user's role can access are shown (driven by RBAC permissions).
 */
export function Sidebar({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const { user } = useAuth();

  const visible = NAV_ITEMS.filter((item) =>
    canAccessNavItem(user?.permissions, item),
  );
  const commercial = visible.filter((item) => item.group === 'commercial');
  const platform = visible.filter((item) => item.group === 'platform');

  return (
    <aside
      className={[
        'flex h-screen flex-none flex-col border-r border-border bg-surface transition-[width] duration-200',
        isCollapsed ? 'w-16' : 'w-64',
      ].join(' ')}
    >
      <div className={`flex h-14 items-center ${isCollapsed ? 'justify-center' : 'px-3'}`}>
        <div className={`overflow-hidden ${isCollapsed ? 'w-6' : 'ml-2 flex-1'}`}>
          <BrandMark className="h-6 w-[120px] max-w-none" />
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="grid h-9 w-9 flex-none place-items-center rounded text-muted hover:bg-bg hover:text-ink"
          aria-label={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight size={18} strokeWidth={1.75} />
          ) : (
            <ChevronLeft size={18} strokeWidth={1.75} />
          )}
        </button>
      </div>

      <nav className={`flex-1 overflow-y-auto py-2 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {commercial.length > 0 ? (
          <>
            {!isCollapsed ? <SectionLabel>Comercial</SectionLabel> : null}
            {commercial.map((item) => (
              <Item key={item.key} item={item} isCollapsed={isCollapsed} />
            ))}
          </>
        ) : null}

        {platform.length > 0 ? (
          <>
            {!isCollapsed ? (
              <SectionLabel className={commercial.length > 0 ? 'mt-4' : ''}>
                Plataforma
              </SectionLabel>
            ) : commercial.length > 0 ? (
              <div className="mx-2 my-3 border-t border-border" />
            ) : null}
            {platform.map((item) => (
              <Item key={item.key} item={item} isCollapsed={isCollapsed} />
            ))}
          </>
        ) : null}
      </nav>

      {!isCollapsed ? (
        <div className="border-t border-border px-4 py-3 text-xs text-muted">
          CRM Frisson · v0.1
        </div>
      ) : null}
    </aside>
  );
}

function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted ${className}`}
    >
      {children}
    </p>
  );
}

function Item({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) {
  const { label, path, icon: Icon } = item;
  return (
    <NavLink
      to={path}
      title={isCollapsed ? label : undefined}
      aria-label={isCollapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'group flex items-center rounded py-2 text-sm transition-colors',
          isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
          isActive ? 'bg-brand text-white' : 'text-ink hover:bg-bg',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex-none">
            <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
          </span>
          {!isCollapsed ? <span className="truncate">{label}</span> : null}
        </>
      )}
    </NavLink>
  );
}
