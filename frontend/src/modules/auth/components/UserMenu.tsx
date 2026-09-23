import { useEffect, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ChangePasswordModal } from './ChangePasswordModal';

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

const menuItemClass =
  'flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-sm font-bold text-ink hover:bg-bg';

/** Header identity block: name, role and a menu to change the password. */
export function UserMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initials = user ? getInitials(user.full_name) : '?';

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  return (
    <>
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          className="flex items-center gap-3 rounded px-1 py-1 text-left hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Menú de usuario"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="hidden text-right sm:block">
            <span className="block text-xs font-bold text-ink">{user?.full_name}</span>
            <span className="block text-[11px] font-normal text-muted">
              {user?.role_name}
            </span>
          </span>
          <span
            className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-white"
            aria-hidden
          >
            {initials}
          </span>
        </button>

        {open ? (
          <div
            className="absolute right-0 z-40 mt-2 min-w-48 overflow-hidden rounded border border-border bg-surface shadow-card"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                setOpen(false);
                setPasswordOpen(true);
              }}
            >
              <KeyRound size={16} strokeWidth={2} aria-hidden />
              Cambiar contraseña
            </button>
          </div>
        ) : null}
      </div>

      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
    </>
  );
}
