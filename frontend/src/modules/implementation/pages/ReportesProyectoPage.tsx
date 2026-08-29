import { AppLayout } from '../../../layout/AppLayout';
import { ImplementationNav } from '../components/ImplementationNav';
import { ReporteProyectosView } from '../components/ReporteProyectosView';

export function ReportesProyectoPage() {
  return (
    <AppLayout title="Implementación (SER)">
      <ImplementationNav />
      <h1 className="mb-4 text-xl font-bold text-ink">Reportes de proyecto</h1>
      <ReporteProyectosView />
    </AppLayout>
  );
}

export default ReportesProyectoPage;
