import { AppLayout } from '../../layout/AppLayout';

/**
 * Example page showing how a module screen consumes the shell.
 * Real pages live under modules/<module>/pages and follow 200-frontend-react.mdc.
 */
export function OpportunitiesPage() {
  return (
    <AppLayout title="Oportunidades (OUV)">
      <div className="rounded bg-surface p-8 shadow-card">
        <p className="text-sm text-muted">
          Aquí va el pipeline de oportunidades (Kanban por etiqueta: Universo · Encima de Funnel ·
          Funnel · Mayor Probabilidad). Construir siguiendo las reglas de UI y de módulo.
        </p>
      </div>
    </AppLayout>
  );
}
