import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { canAccessNavItem, NAV_ITEMS, type NavItem } from '../lib/navigation';
import { useAuth } from '../modules/auth/hooks/useAuth';
import { BrandMark } from './BrandMark';

/**
 * Minimalist Verytel sidebar. White surface, hairline divider, brand-primary active state.
 * Density and structure follow a Pipedrive-like work tool: icons + labels, no decoration.
 * Only modules the user's role can access are shown (driven by RBAC permissions).
 */
export function Sidebar() {
  const { user } = useAuth();

  const visible = NAV_ITEMS.filter((item) =>
    canAccessNavItem(user?.permissions, item),
  );
  const commercial = visible.filter((item) => item.group === 'commercial');
  const platform = visible.filter((item) => item.group === 'platform');

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center gap-2 px-5">
        <BrandMark className="h-6 w-auto" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {commercial.length > 0 ? (
          <>
            <SectionLabel>Comercial</SectionLabel>
            {commercial.map((item) => (
              <Item key={item.key} item={item} />
            ))}
          </>
        ) : null}

        {platform.length > 0 ? (
          <>
            <SectionLabel className={commercial.length > 0 ? 'mt-4' : ''}>
              Plataforma
            </SectionLabel>
            {platform.map((item) => (
              <Item key={item.key} item={item} />
            ))}
          </>
        ) : null}
      </nav>

      <div className="border-t border-border px-4 py-3 text-xs text-muted">CRM Frisson · v0.1</div>
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

function Item({ item }: { item: NavItem }) {
  const { label, path, icon: Icon } = item;
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-brand text-white' : 'text-ink hover:bg-bg',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}
