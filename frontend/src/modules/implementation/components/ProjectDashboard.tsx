import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import type { VentaGanadaRecord } from '../../shared/project/types';
import { upsertVentaGanada } from '../../shared/project/mock-store';
import { AlertaBadge } from '../../shared/project/AlertaBadge';
import { CSATIndicator } from '../../shared/project/CSATIndicator';
import { FormularioDatosProyecto } from '../../offer-closing/components/FormularioDatosProyecto';
import { IndicadoresDashboard } from './IndicadoresDashboard';
import { cardClass, ghostButtonClass, primaryButtonClass } from './ui';

type Props = {
  record: VentaGanadaRecord;
  onUpdate?: (r: VentaGanadaRecord) => void;
};

/** HU-F06 + HU-F08 — Dashboard desempeño + alertas/CSAT (mock CP). */
export function ProjectDashboard({ record, onUpdate }: Props) {
  const { user } = useAuth();
  const [showAmpliar, setShowAmpliar] = useState(false);
  const canEditCsat =
    user?.role_name === 'Admin' ||
    user?.role_name === 'SoporteComercial';

  function saveCsat(valor: number) {
    const next = upsertVentaGanada({
      ...record,
      csat: {
        ...record.csat,
        valor,
        fecha: new Date().toISOString(),
      },
    });
    onUpdate?.(next);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Control de Proyectos (simulado)</p>
          <h1 className="text-xl font-bold text-ink">{record.datosBase.nombreProyecto}</h1>
          <p className="text-sm text-accent">{record.envioPmo.serConsecutivo}</p>
          <p className="text-xs text-muted">
            OUV origen:{' '}
            <Link to="/opportunities" className="text-accent hover:underline">
              {record.consecutivo}
            </Link>
            · CP {record.envioPmo.consecutivoControlProyectos}
          </p>
        </div>
        <button
          type="button"
          className={ghostButtonClass}
          onClick={() => setShowAmpliar(true)}
        >
          Ampliar proyecto
        </button>
      </header>

      <div className={`${cardClass} border border-brand/20`}>
        <p className="text-xs font-bold text-muted">Acumulado global · Fuente: CERES (mock)</p>
        <p className="mt-1 text-sm">
          Proyectos activos en CP: 12 · Facturación acumulada: $ 48.200 MM · Margen promedio: 28%
        </p>
      </div>

      <IndicadoresDashboard indicadores={record.indicadores} />

      <section className={cardClass}>
        <h2 className="mb-3 text-sm font-bold text-ink">Línea de tiempo</h2>
        <ol className="space-y-2 border-l-2 border-border pl-4">
          {record.historialEstados.map((h, i) => (
            <li key={i} className="text-sm">
              <span className="font-bold">{h.estado}</span>
              <span className="text-muted"> · {new Date(h.fecha).toLocaleDateString('es-CO')} · {h.origen}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={cardClass}>
        <h2 className="mb-3 text-sm font-bold text-ink">Alertas operativas</h2>
        {record.alertas.length === 0 ? (
          <p className="text-sm text-muted">Sin alertas activas.</p>
        ) : (
          <div className="space-y-2">
            {record.alertas.map((a) => (
              <AlertaBadge key={a.id} alerta={a} />
            ))}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="mb-3 text-sm font-bold text-ink">Satisfacción del cliente (CSAT)</h2>
        <CSATIndicator
          csat={record.csat}
          mode={canEditCsat ? 'editable' : 'readOnly'}
          onSave={saveCsat}
        />
      </section>

      {showAmpliar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded bg-surface p-6">
            <h2 className="mb-4 text-lg font-bold">Ampliar proyecto</h2>
            <FormularioDatosProyecto
              datos={record.datosBase}
              modo="ampliar"
              onChange={(datosBase) => {
                const next = upsertVentaGanada({ ...record, datosBase });
                onUpdate?.(next);
              }}
            />
            <button
              type="button"
              className={`${primaryButtonClass} mt-4`}
              onClick={() => setShowAmpliar(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
