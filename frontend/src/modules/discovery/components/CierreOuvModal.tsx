import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../auth/types';
import {
  descartarOuv,
  ganarOuv,
  perderOuv,
  type Ouv,
} from '../api/ouvs-api';
import {
  fetchMotivosDescarte,
  fetchMotivosPerdida,
  type MotivoCatalogo,
} from '../api/catalogos-api';
import { OUV_ZONA_LABEL, type OuvZona } from '../lib/ouv-vocab';
import { appendOuvInteraccion } from '../lib/ouv-interacciones';
import { ModalShell } from './ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type ResultadoCierre = 'Ganada' | 'Perdida' | 'Descartada';

type Props = {
  ouv: Ouv;
  onClose: () => void;
  onClosed: (resultado: ResultadoCierre) => void;
  /** Resultado elegido en Estado OUV — el modal solo muestra ese flujo. */
  initialResultado: ResultadoCierre;
};

export function CierreOuvModal({
  ouv,
  onClose,
  onClosed,
  initialResultado,
}: Props) {
  const resultado = initialResultado;
  const [motivosPerdida, setMotivosPerdida] = useState<MotivoCatalogo[]>([]);
  const [motivosDescarte, setMotivosDescarte] = useState<MotivoCatalogo[]>(
    [],
  );
  const [motivoId, setMotivoId] = useState('');
  const [motivoDetalle, setMotivoDetalle] = useState('');
  const [montoFinal, setMontoFinal] = useState('');
  const [monedaFinal, setMonedaFinal] = useState('COP');
  const [montoPerdido, setMontoPerdido] = useState('0');
  const [competidor, setCompetidor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([fetchMotivosPerdida(), fetchMotivosDescarte()])
      .then(([p, d]) => {
        setMotivosPerdida(p);
        setMotivosDescarte(d);
      })
      .catch(() => {
        /* empty catalogs ok for UX; submit will fail if required */
      });
  }, []);

  const motivos =
    resultado === 'Descartada' ? motivosDescarte : motivosPerdida;
  const selected = motivos.find((m) => m.motivo_id === motivoId);
  const needsCompetidor =
    resultado === 'Perdida' &&
    Boolean(selected?.nombre && /competidor/i.test(selected.nombre));
  const showDetalleGanada =
    resultado === 'Ganada' && Boolean(motivoId);

  const titleByResultado: Record<ResultadoCierre, string> = {
    Ganada: 'OUV Ganada',
    Perdida: 'OUV Perdida',
    Descartada: 'OUV Descartada',
  };

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (resultado === 'Ganada') {
        if (ouv.zona_actual !== 'MAYOR_PROBABILIDAD') {
          throw new Error(
            'Ganada solo desde zona Mayor Probabilidad (Wave 1).',
          );
        }
        const monto = Number(montoFinal);
        if (!Number.isFinite(monto) || monto < 0) {
          throw new Error('Monto final inválido.');
        }
        await ganarOuv(ouv.ouv_id, {
          motivo_id: motivoId || undefined,
          motivo_detalle: motivoDetalle.trim() || undefined,
          monto_final: monto,
          moneda_final: monedaFinal,
        });
      } else if (resultado === 'Perdida') {
        if (!motivoId) throw new Error('Selecciona un motivo de pérdida.');
        if (!motivoDetalle.trim()) {
          throw new Error('Registra las observaciones de la OUV perdida.');
        }
        const monto = Number(montoPerdido || '0');
        if (!Number.isFinite(monto) || monto < 0) {
          throw new Error('Monto estimado perdido inválido.');
        }
        if (needsCompetidor && !competidor.trim()) {
          throw new Error('Indica el competidor ganador.');
        }
        await perderOuv(ouv.ouv_id, {
          motivo_id: motivoId,
          motivo_detalle: motivoDetalle.trim(),
          monto_estimado_perdido: monto,
          competidor_ganador: competidor.trim() || undefined,
        });

        const zonaLabel =
          OUV_ZONA_LABEL[ouv.zona_actual as OuvZona] ?? ouv.zona_actual;
        const motivoNombre = selected?.nombre ?? 'Motivo de pérdida';
        appendOuvInteraccion(ouv.ouv_id, {
          titulo: `OUV perdida — ${motivoNombre}`,
          observaciones: motivoDetalle.trim(),
          etiquetas: [
            'OUV Perdida',
            `Motivo: ${motivoNombre}`,
            `Zona: ${zonaLabel}`,
          ],
        });
      } else {
        if (!motivoId) throw new Error('Selecciona un motivo de descarte.');
        if (!motivoDetalle.trim()) {
          throw new Error(
            'Registra las observaciones de la OUV descartada.',
          );
        }
        await descartarOuv(ouv.ouv_id, {
          motivo_id: motivoId,
          motivo_detalle: motivoDetalle.trim(),
        });

        const zonaLabel =
          OUV_ZONA_LABEL[ouv.zona_actual as OuvZona] ?? ouv.zona_actual;
        const motivoNombre = selected?.nombre ?? 'Motivo de descarte';
        appendOuvInteraccion(ouv.ouv_id, {
          titulo: `OUV descartada — ${motivoNombre}`,
          observaciones: motivoDetalle.trim(),
          etiquetas: [
            'OUV Descartada',
            `Motivo: ${motivoNombre}`,
            `Zona: ${zonaLabel}`,
          ],
        });
      }
      onClosed(resultado);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo cerrar la OUV.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={titleByResultado[resultado]} onClose={onClose} size="slim">
      <form onSubmit={(e) => void confirm(e)}>
        {resultado === 'Ganada' ? (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Requiere zona Mayor Probabilidad (actual: {ouv.zona_actual}).
            </p>
            <div>
              <label className={labelClass}>Motivo (opcional)</label>
              <select
                className={inputClass}
                value={motivoId}
                onChange={(e) => setMotivoId(e.target.value)}
              >
                <option value="">—</option>
                {motivosPerdida.map((m) => (
                  <option key={m.motivo_id} value={m.motivo_id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Monto final</label>
                <input
                  className={inputClass}
                  value={montoFinal}
                  onChange={(e) => setMontoFinal(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Moneda</label>
                <select
                  className={inputClass}
                  value={monedaFinal}
                  onChange={(e) => setMonedaFinal(e.target.value)}
                >
                  <option value="COP">COP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>
        ) : null}

        {resultado === 'Perdida' ? (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Quedará en Oportunidades perdidas ·{' '}
              {OUV_ZONA_LABEL[ouv.zona_actual as OuvZona] ?? ouv.zona_actual}.
            </p>
            <div>
              <label className={labelClass} htmlFor="cierre-motivo-perdida">
                Motivo de pérdida
              </label>
              <select
                id="cierre-motivo-perdida"
                className={inputClass}
                value={motivoId}
                onChange={(e) => setMotivoId(e.target.value)}
                required
              >
                <option value="">Selecciona…</option>
                {motivosPerdida.map((m) => (
                  <option key={m.motivo_id} value={m.motivo_id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              {motivosPerdida.length === 0 ? (
                <p className="mt-1 text-xs text-danger">
                  No hay motivos cargados. Ejecuta el seed de motivos de
                  pérdida o créalos en catálogo.
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelClass} htmlFor="cierre-obs-perdida">
                Observaciones
              </label>
              <textarea
                id="cierre-obs-perdida"
                className={`${inputClass} min-h-24 py-2`}
                value={motivoDetalle}
                onChange={(e) => setMotivoDetalle(e.target.value)}
                placeholder="Describe por qué se pierde la OUV…"
                required
              />
              <p className="mt-1 text-xs text-muted">
                Se registra en Interacciones con etiquetas de pérdida.
              </p>
            </div>
            <div>
              <label className={labelClass}>Monto estimado perdido</label>
              <input
                className={inputClass}
                value={montoPerdido}
                onChange={(e) => setMontoPerdido(e.target.value)}
              />
            </div>
            {needsCompetidor ? (
              <div>
                <label className={labelClass}>Competidor ganador</label>
                <input
                  className={inputClass}
                  value={competidor}
                  onChange={(e) => setCompetidor(e.target.value)}
                  required
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {resultado === 'Descartada' ? (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Quedará en Oportunidades descartadas ·{' '}
              {OUV_ZONA_LABEL[ouv.zona_actual as OuvZona] ?? ouv.zona_actual}.
            </p>
            <div>
              <label className={labelClass} htmlFor="cierre-motivo-descarte">
                Motivo de descarte
              </label>
              <select
                id="cierre-motivo-descarte"
                className={inputClass}
                value={motivoId}
                onChange={(e) => setMotivoId(e.target.value)}
                required
              >
                <option value="">Selecciona…</option>
                {motivosDescarte.map((m) => (
                  <option key={m.motivo_id} value={m.motivo_id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              {motivosDescarte.length === 0 ? (
                <p className="mt-1 text-xs text-danger">
                  No hay motivos cargados. Ejecuta el seed de motivos de
                  descarte o créalos en catálogo.
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelClass} htmlFor="cierre-obs-descarte">
                Observaciones
              </label>
              <textarea
                id="cierre-obs-descarte"
                className={`${inputClass} min-h-24 py-2`}
                value={motivoDetalle}
                onChange={(e) => setMotivoDetalle(e.target.value)}
                placeholder="Describe por qué se descarta la OUV…"
                required
              />
              <p className="mt-1 text-xs text-muted">
                Se registra en Interacciones con etiquetas de descarte.
              </p>
            </div>
          </div>
        ) : null}

        {showDetalleGanada ? (
          <div className="mt-3">
            <label className={labelClass}>Detalle del motivo</label>
            <textarea
              className={`${inputClass} h-20 py-2`}
              value={motivoDetalle}
              onChange={(e) => setMotivoDetalle(e.target.value)}
            />
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={saving}
          >
            {saving ? 'Cerrando…' : 'Confirmar cierre'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
