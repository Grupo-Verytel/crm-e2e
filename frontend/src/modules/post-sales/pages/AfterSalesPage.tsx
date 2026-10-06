import { SearchX } from 'lucide-react';
import { AppLayout } from '../../../layout/AppLayout';
import { useModuleSearch } from '../../../layout/useModuleSearch';

/** Posventa still has no records. The header search stays honest about that. */
export function AfterSalesPage() {
  const { query, setDraft } = useModuleSearch();

  return (
    <AppLayout title="Posventa">
      <div className="rounded bg-surface p-8 shadow-card">
        {query ? (
          <div className="flex flex-col items-start gap-3">
            <SearchX size={22} strokeWidth={1.75} className="text-muted" aria-hidden />
            <p className="text-sm font-bold text-ink">
              Sin resultados para “{query}”
            </p>
            <p className="text-sm text-muted">
              Posventa todavía no tiene novedades, renovaciones ni servicios
              registrados. Cuando existan, esta búsqueda los va a encontrar por
              cliente, novedad o servicio.
            </p>
            <button
              type="button"
              className="text-sm font-bold text-accent hover:underline"
              onClick={() => setDraft('')}
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Renovaciones y ChurnRate — módulo post-sales (próximamente). Escribe
            en el buscador para probar la búsqueda; aún no hay registros.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
