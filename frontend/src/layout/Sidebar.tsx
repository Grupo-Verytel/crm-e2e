import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { canAccessNavItem, NAV_ITEMS, type NavItem } from '../lib/navigation';
import { useAuth } from '../modules/auth/hooks/useAuth';
import { BrandMark } from './BrandMark';

const NAV_GROUPS: { id: NavItem['group']; label: string }[] = [
  { id: 'commercial', label: 'Comercial' },
  { id: 'reports', label: 'Reportes' },
  { id: 'platform', label: 'Plataforma' },
];

/**
 * Minimalist Verytel sidebar. White surface, hairline divider, Oriole active state.
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visible = NAV_ITEMS.filter((item) =>
    canAccessNavItem(user?.permissions, item),
  );
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: visible.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside
      className={[
        'flex h-full min-h-0 flex-none flex-col border-r border-border bg-surface transition-[width] duration-200',
        isCollapsed ? 'w-16' : 'w-64',
      ].join(' ')}
    >
      <div className={`flex h-14 items-center ${isCollapsed ? 'justify-center' : 'px-3'}`}>
        <div className={`overflow-hidden ${isCollapsed ? 'w-6' : 'ml-2 flex-1'}`}>
          <BrandMark className="h-6" showWordmark={!isCollapsed} />
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="icon-btn grid h-9 w-9 flex-none place-items-center rounded"
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
        {groups.map((group, index) => (
          <div key={group.id}>
            {index > 0 ? (
              isCollapsed ? (
                <div className="mx-2 my-3 border-t border-border" />
              ) : (
                <SectionLabel className="mt-4">{group.label}</SectionLabel>
              )
            ) : !isCollapsed ? (
              <SectionLabel>{group.label}</SectionLabel>
            ) : null}
            {group.items.map((item) => (
              <Item key={item.key} item={item} isCollapsed={isCollapsed} />
            ))}
          </div>
        ))}
      </nav>

      <div
        className={[
          'border-t border-border',
          isCollapsed ? 'p-2' : 'px-3 py-3',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={() => void handleLogout()}
          className={[
            'icon-btn inline-flex w-full items-center rounded text-sm font-bold',
            isCollapsed ? 'h-9 justify-center px-0' : 'h-9 gap-2 px-3',
          ].join(' ')}
          aria-label="Cerrar sesión"
          title="Salir"
        >
          <LogOut size={16} strokeWidth={1.75} />
          {!isCollapsed ? <span>Salir</span> : null}
        </button>
      </div>
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
          isActive
            ? 'btn-glow'
            : 'text-ink hover:bg-accent/15 hover:text-accent',
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
