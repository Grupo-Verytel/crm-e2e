import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import { listProyectosEnImplementacion } from '../../shared/project/mock-store';
import type { VentaGanadaRecord } from '../../shared/project/types';
import { ImplementationNav } from '../components/ImplementationNav';
import { badgeClass, cardClass } from '../components/ui';

/** Lista de SER — proyectos recibidos desde Control de Proyectos (mock). */
export function ServicesListPage() {
  const [items, setItems] = useState<VentaGanadaRecord[]>([]);

  useEffect(() => {
    setItems(listProyectosEnImplementacion());
  }, []);

  return (
    <AppLayout title="Implementación (SER)">
      <ImplementationNav />

      <div className="mb-4">
        <h1 className="text-xl font-bold text-ink">Servicios activos</h1>
        <p className="text-sm text-muted">
          Datos simulados procedentes de Control de Proyectos — sin integración API real.
        </p>
      </div>

      <div className={`${cardClass} overflow-x-auto p-0`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="px-4 py-3">SER</th>
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">OUV origen</th>
              <th className="px-4 py-3">CP ID</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Enviado</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Aún no hay proyectos en implementación. Completa el flujo en{' '}
                  <Link to="/offers" className="text-accent hover:underline">
                    Oferta & Cierre
                  </Link>{' '}
                  (OUV demo OUV-0245 está lista para enviar; OUV-0238 ya está aquí).
                </td>
              </tr>
            ) : (
              items.map((v) => (
                <tr key={v.ouvId} className="border-b border-border hover:bg-accent/5">
                  <td className="px-4 py-3">
                    <Link
                      to={`/services/${v.ouvId}`}
                      className="font-bold text-accent hover:underline"
                    >
                      {v.envioPmo.serConsecutivo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{v.datosBase.nombreProyecto}</td>
                  <td className="px-4 py-3 text-xs">{v.consecutivo}</td>
                  <td className="px-4 py-3 text-xs">{v.envioPmo.consecutivoControlProyectos}</td>
                  <td className="px-4 py-3">{v.empresaNombre}</td>
                  <td className="px-4 py-3">
                    <span className={`${badgeClass} bg-positive/15 text-positive`}>
                      {v.indicadores.ejecucion.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {v.envioPmo.enviadoEn ? formatDateTime(v.envioPmo.enviadoEn) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

export default ServicesListPage;
