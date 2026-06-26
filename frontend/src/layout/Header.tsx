import { Search, Bell, Plus } from 'lucide-react';

/**
 * Top header: global search (Pipedrive-style), quick create, notifications, user.
 * Brand-primary is reserved for the primary action button only.
 */
export function Header({ title }: { title: string }) {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-6">
      <h1 className="text-sm font-bold text-ink">{title}</h1>

      <div className="relative ml-2 max-w-md flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Buscar oportunidades, cuentas, contactos…"
          className="h-9 w-full rounded border border-border bg-bg pl-9 pr-3 text-sm text-ink outline-none focus:border-brand focus:bg-surface"
        />
      </div>

      <button className="inline-flex h-9 items-center gap-2 rounded bg-brand px-3 text-sm font-bold text-white hover:bg-brand-700">
        <Plus size={16} strokeWidth={2.25} />
        Nuevo
      </button>

      <button className="relative grid h-9 w-9 place-items-center rounded text-ink hover:bg-bg" aria-label="Notificaciones">
        <Bell size={18} strokeWidth={1.75} />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-turquoise" />
      </button>

      <div className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-bold text-white">EV</div>
    </header>
  );
}
