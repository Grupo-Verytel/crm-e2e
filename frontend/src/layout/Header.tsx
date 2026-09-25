import { Moon, Sun } from 'lucide-react';
import { NotificationBell } from '../modules/auth/components/NotificationBell';
import { UserMenu } from '../modules/auth/components/UserMenu';
import { useTheme } from '../theme/useTheme';
import { useModuleSearch } from './useModuleSearch';

/** Top header: global search, theme toggle and authenticated user. */
export function Header({ title }: { title: string }) {
  const { theme, setTheme } = useTheme();
  const { draft, setDraft, placeholder, enabled } = useModuleSearch();
  // const initials = user ? getInitials(user.full_name) : '?';
  const isDark = theme === 'dark';

  return (
    <header className="grid h-14 grid-cols-[minmax(0,1fr)_minmax(12rem,28rem)_minmax(0,1fr)] items-center gap-4 border-b border-border bg-surface px-6">
      <h1 className="truncate text-sm font-bold text-ink">{title}</h1>

      <div className="w-full min-w-0 -translate-x-10 justify-self-center">
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          disabled={!enabled}
          className="h-9 w-full rounded border border-border bg-bg pl-3 pr-3 text-sm text-ink outline-none focus:border-accent focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Buscar en este módulo"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
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
