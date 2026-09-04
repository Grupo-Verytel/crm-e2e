import { useState } from 'react';
import type { VentaGanadaRecord } from '../../shared/project/types';
import {
  checklistAvancePct,
  mockEnviarAPmo,
  validateDatosBase,
} from '../../shared/project/mock-store';
import { CSATIndicator } from '../../shared/project/CSATIndicator';
import { cardClass, ghostButtonClass, primaryButtonClass } from './ui';

type Props = {
  record: VentaGanadaRecord;
  open: boolean;
  onClose: () => void;
  onSent: (updated: VentaGanadaRecord) => void;
};

/** HU-F03 — Resumen y confirmación de envío a PMO (mock Control de Proyectos). */
export function ResumenEnvioPmoModal({ record, open, onClose, onSent }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const pct = checklistAvancePct(record);
  const missing = validateDatosBase(record.datosBase);
  const canSend = pct >= 100 && missing.length === 0;

  async function confirmar() {
    setLoading(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 800));
      const updated = mockEnviarAPmo(record.ouvId);
      onSent(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error simulado de envío');
    } finally {
      setLoading(false);
    }
  }

  const { datosBase: d, indicadores: ind } = record;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded bg-surface p-6 shadow-card">
        <h2 className="text-lg font-bold text-ink">Resumen de envío a Control de Proyectos</h2>
        <p className="mt-1 text-sm text-muted">{record.consecutivo} — {d.nombreProyecto}</p>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs font-bold">
            <span>Checklist de envío</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-border">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {missing.length > 0 ? (
          <ul className="mt-3 text-sm text-accent">
            {missing.map((m) => (
              <li key={m}>Falta: {m}</li>
            ))}
          </ul>
        ) : null}

        <div className={`${cardClass} mt-4 space-y-2 text-sm`}>
          <h3 className="font-bold text-ink">Datos base (solo lectura)</h3>
          <p>Valor contrato: ${d.valorFacturar.toLocaleString('es-CO')} COP</p>
          <p>Tipo: {d.recurrente ? 'Recurrente' : 'No recurrente'}</p>
          <p>Inicio: {d.fechaInicio || '—'} · Fin: {d.fechaFin || '—'}</p>
          <p>Participación: {d.participacion} ({d.participacionPct}%)</p>
          <p>Centro de costos: {d.centroCostos || '—'} · UBV: {d.ubv || '—'}</p>
        </div>

        <div className={`${cardClass} mt-4 grid gap-2 text-sm sm:grid-cols-2`}>
          <h3 className="sm:col-span-2 font-bold text-ink">Indicadores (Control de Proyectos — mock)</h3>
          <p>Costos: {ind.costos.valor ?? 'Sin dato disponible'}</p>
          <p>Tiempo: {ind.tiempo.valor ?? 'Sin dato disponible'}</p>
          <p>Ejecución: {ind.ejecucion.valor ?? 'Sin dato disponible'}</p>
          <p>Alcance: {ind.alcance.valor ?? 'Sin dato disponible'}</p>
          <p>Facturación: {ind.facturacion.valor ?? 'Sin dato disponible'}</p>
        </div>

        <div className={`${cardClass} mt-4`}>
          <h3 className="mb-2 text-sm font-bold text-ink">CSAT</h3>
          <CSATIndicator csat={record.csat} mode="readOnly" />
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={!canSend || loading}
            onClick={() => void confirmar()}
          >
            {loading ? 'Enviando…' : 'Confirmar envío'}
          </button>
        </div>
      </div>
    </div>
  );
}
