import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../modules/auth/hooks/useAuth';

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Top header: global search and authenticated user controls. */
export function Header({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = user ? getInitials(user.full_name) : '?';

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-6">
      <h1 className="text-sm font-bold text-ink">{title}</h1>

      <div className="relative ml-2 max-w-md flex-1">
        <input
          type="search"
          placeholder="Buscar oportunidades, cuentas, contactos…"
          className="h-9 w-full rounded border border-border bg-bg pl-3 pr-3 text-sm text-ink outline-none focus:border-brand focus:bg-surface"
          aria-label="Buscar"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-bold text-ink">{user?.full_name}</p>
          <p className="text-[11px] text-muted">{user?.role_name}</p>
        </div>

        <div
          className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-bold text-white"
          aria-hidden
        >
          {initials}
        </div>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="inline-flex h-9 items-center gap-2 rounded px-2 text-sm text-ink hover:bg-bg"
          aria-label="Cerrar sesión"
        >
          <LogOut size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}
