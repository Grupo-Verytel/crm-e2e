import { Moon, Search, Sun, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { NotificationBell } from '../modules/auth/components/NotificationBell';
import { UserMenu } from '../modules/auth/components/UserMenu';
import { useTheme } from '../theme/useTheme';
import { useModuleSearch } from './useModuleSearch';

/** Top header: live search, theme toggle and authenticated user. */
export function Header({ title }: { title: string }) {
  const { theme, setTheme } = useTheme();
  const { draft, setDraft, query, placeholder, enabled } = useModuleSearch();
  const isDark = theme === 'dark';
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [focused, setFocused] = useState(false);
  const pending = enabled && draft.trim() !== query;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!enabled) return;
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT')
        ) {
          return;
        }
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);

  return (
    <header className="grid h-14 grid-cols-[minmax(0,1fr)_minmax(12rem,32rem)_minmax(0,1fr)] items-center gap-4 border-b border-border bg-surface px-6">
      <h1 className="truncate text-sm font-bold text-ink">{title}</h1>

      <div className="w-full min-w-0 -translate-x-10 justify-self-center">
        <label htmlFor={inputId} className="sr-only">
          Buscar en este módulo
        </label>
        <div
          className={`relative ${enabled ? '' : 'opacity-60'}`}
          data-pending={pending ? 'true' : 'false'}
        >
          <Search
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            id={inputId}
            ref={inputRef}
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && draft) {
                event.preventDefault();
                setDraft('');
              }
            }}
            placeholder={placeholder}
            disabled={!enabled}
            aria-label="Buscar en este módulo"
            aria-busy={pending}
            className="h-9 w-full rounded-full border border-border bg-bg pl-9 pr-16 text-sm text-ink outline-none transition-[border-color,box-shadow] focus:border-accent focus:bg-surface focus:shadow-card disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          />
          {enabled && draft ? (
            <button
              type="button"
              onClick={() => {
                setDraft('');
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
              aria-label="Limpiar búsqueda"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          ) : enabled && !focused ? (
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-surface px-1.5 text-[10px] font-bold text-muted">
              /
            </kbd>
          ) : null}
        </div>
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
