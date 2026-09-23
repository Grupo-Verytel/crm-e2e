import { Moon, Sun } from 'lucide-react';
import { NotificationBell } from '../modules/auth/components/NotificationBell';
import { UserMenu } from '../modules/auth/components/UserMenu';
import { useTheme } from '../theme/useTheme';

/** Top header: global search, theme toggle and authenticated user. */
export function Header({ title }: { title: string }) {
  const { theme, setTheme } = useTheme();
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
        <NotificationBell />

        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="icon-btn grid h-9 w-9 place-items-center rounded"
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          {isDark ? (
            <Sun size={16} strokeWidth={1.75} />
          ) : (
            <Moon size={16} strokeWidth={1.75} />
          )}
        </button>

        <UserMenu />
      </div>
    </header>
  );
}
