import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../modules/auth/hooks/useAuth';
import { useTheme } from '../theme/useTheme';

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

/** Top header: global search, theme toggle and authenticated user. */
export function Header({ title }: { title: string }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const initials = user ? getInitials(user.full_name) : '?';
  const isDark = theme === 'dark';

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-6">
      <h1 className="text-sm font-bold text-ink">{title}</h1>

      <div className="relative ml-2 max-w-md flex-1">
        <input
          type="search"
          placeholder="Buscar oportunidades, cuentas, contactos…"
          className="h-9 w-full rounded border border-border bg-bg pl-3 pr-3 text-sm text-ink outline-none focus:border-accent focus:bg-surface"
          aria-label="Buscar"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="btn-glow-outline grid h-9 w-9 place-items-center rounded"
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          {isDark ? (
            <Sun size={16} strokeWidth={1.75} />
          ) : (
            <Moon size={16} strokeWidth={1.75} />
          )}
        </button>

        <div className="hidden text-right sm:block">
          <p className="text-xs font-bold text-ink">{user?.full_name}</p>
          <p className="text-[11px] text-muted">{user?.role_name}</p>
        </div>

        <div
          className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-white"
          aria-hidden
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
