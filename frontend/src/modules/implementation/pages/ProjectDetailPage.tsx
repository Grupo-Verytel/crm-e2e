import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { getVentaGanada } from '../../shared/project/mock-store';
import type { VentaGanadaRecord } from '../../shared/project/types';
import { ProjectDashboard } from '../components/ProjectDashboard';

export function ProjectDetailPage() {
  const { ouvId } = useParams<{ ouvId: string }>();
  const [record, setRecord] = useState<VentaGanadaRecord | null>(null);

  useEffect(() => {
    if (ouvId) setRecord(getVentaGanada(ouvId));
  }, [ouvId]);

  if (!record || record.envioPmo.estado !== 'Enviado') {
    return (
      <AppLayout title="Implementación (SER)">
        <p className="text-muted">Proyecto no encontrado o aún no enviado a Control de Proyectos.</p>
        <Link to="/services" className="mt-3 inline-block text-sm text-accent hover:underline">
          ← Servicios
        </Link>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Implementación (SER)">
      <Link to="/services" className="mb-3 inline-block text-sm text-accent hover:underline">
        ← Servicios
      </Link>
      <ProjectDashboard record={record} onUpdate={setRecord} />
    </AppLayout>
  );
}

export default ProjectDetailPage;
