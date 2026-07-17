import { CHANNEL_ROUTES, KANBAN_COLUMNS } from '../../lib/lead-vocab';
import type { CanalOrigen, LeadEstado } from '../../types';

export function ExpectedRoute({
  canalOrigen,
  currentState,
}: {
  canalOrigen: CanalOrigen;
  currentState: LeadEstado;
}) {
  const route = CHANNEL_ROUTES[canalOrigen];

  if (!route) {
    return (
      <div className="rounded border border-border bg-bg p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Ruta esperada
        </p>
        <p className="mt-1 text-sm text-muted">
          Pendiente de definición para Traductor de negocio.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded border border-border bg-bg p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
        Ruta esperada
      </p>
      <ol className="flex flex-wrap items-center gap-2">
        {KANBAN_COLUMNS.map((column, index) => {
          const applies = route.includes(column.estado);
          const current = currentState === column.estado;
          return (
            <li key={column.estado} className="flex items-center gap-2">
              {index > 0 ? <span className="text-muted">→</span> : null}
              <span
                className={[
                  'rounded-full border px-3 py-1 text-xs font-bold',
                  current ? 'border-brand bg-brand text-white' : '',
                  !current && applies
                    ? 'border-border bg-surface text-ink'
                    : '',
                  !applies
                    ? 'border-border bg-bg text-muted line-through opacity-50'
                    : '',
                ].join(' ')}
              >
                {column.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
