import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { getVentaGanada } from '../../shared/project/mock-store';
import type { VentaGanadaRecord } from '../../shared/project/types';
import { ImplementationNav } from '../components/ImplementationNav';
import { ProjectDashboard } from '../components/ProjectDashboard';
import { ghostButtonClass } from '../components/ui';

export function ProjectDetailPage() {
  const { ouvId } = useParams<{ ouvId: string }>();
  const [record, setRecord] = useState<VentaGanadaRecord | null>(null);

  useEffect(() => {
    if (ouvId) setRecord(getVentaGanada(ouvId));
  }, [ouvId]);

  if (!record || record.envioPmo.estado !== 'Enviado') {
    return (
      <AppLayout title="Implementación (SER)">
        <ImplementationNav />
        <p className="text-muted">Proyecto no encontrado o aún no enviado a Control de Proyectos.</p>
        <Link to="/services" className={`${ghostButtonClass} mt-4 inline-block`}>
          Volver a servicios
        </Link>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Implementación (SER)">
      <ImplementationNav />
      <Link to="/services" className={`${ghostButtonClass} mb-4 inline-block text-sm`}>
        ← Servicios
      </Link>
      <ProjectDashboard record={record} onUpdate={setRecord} />
    </AppLayout>
  );
}

export default ProjectDetailPage;
