import { useEffect, useState, type FormEvent } from 'react';
import {
  formatAmountEsCo,
  formatAmountInputEsCo,
  parseAmountInputEsCo,
} from '../../../lib/format';
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
import { ModalShell } from './ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

export type ResultadoCierre = 'Ganada' | 'Perdida' | 'Descartada';

export type OuvClosedEvent = {
  resultado: ResultadoCierre;
  ouv: Ouv;
};

type Props = {
  ouv: Ouv;
  onClose: () => void;
  onClosed: (event: OuvClosedEvent) => void;
};

function requireAmount(formatted: string, invalidMessage: string): number {
  const monto = parseAmountInputEsCo(formatted);
  if (monto === null || monto < 0) {
    throw new Error(invalidMessage);
  }
  return monto;
}

function asMotivoList(value: MotivoCatalogo[] | unknown): MotivoCatalogo[] {
  return Array.isArray(value) ? value : [];
}

function presupuestoAmount(ouv: Ouv): string {
  return formatAmountEsCo(ouv.presupuesto_monto) || '';
}

export function CierreOuvModal({ ouv, onClose, onClosed }: Props) {
  const [resultado, setResultado] = useState<ResultadoCierre>('Ganada');
  const [motivosPerdida, setMotivosPerdida] = useState<MotivoCatalogo[]>([]);
  const [motivosDescarte, setMotivosDescarte] = useState<MotivoCatalogo[]>(
    [],
  );
  const [motivoId, setMotivoId] = useState('');
  const [motivoDetalle, setMotivoDetalle] = useState('');
  const [montoFinal, setMontoFinal] = useState(() => presupuestoAmount(ouv));
  const [monedaFinal, setMonedaFinal] = useState(
    ouv.presupuesto_moneda ?? 'COP',
  );
  const [montoPerdido, setMontoPerdido] = useState(() =>
    presupuestoAmount(ouv),
  );
  const [competidor, setCompetidor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchMotivosPerdida(), fetchMotivosDescarte()])
      .then(([p, d]) => {
        if (cancelled) return;
        setMotivosPerdida(asMotivoList(p));
        setMotivosDescarte(asMotivoList(d));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCatalogError(
          err instanceof ApiError
            ? err.message
            : 'No se pudieron cargar los motivos parametrizados.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const motivos =
    resultado === 'Descartada' ? motivosDescarte : motivosPerdida;
  const selected = motivos.find((m) => m.motivo_id === motivoId);
  const needsCompetidor =
    resultado === 'Perdida' &&
    Boolean(selected?.nombre && /competidor/i.test(selected.nombre));
  const observacionRequired =
    resultado === 'Perdida' &&
    (Boolean(selected?.requiere_detalle) || motivosPerdida.length === 0);
  const showDetalle =
    resultado !== 'Perdida' &&
    (Boolean(selected?.requiere_detalle) ||
      (resultado === 'Ganada' && Boolean(motivoId)));

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let closed: Ouv;
      if (resultado === 'Ganada') {
        if (ouv.zona_actual !== 'MAYOR_PROBABILIDAD') {
          throw new Error(
            'Ganada solo desde zona Mayor Probabilidad (Wave 1).',
          );
        }
        const monto = requireAmount(montoFinal, 'Monto final inválido.');
        closed = await ganarOuv(ouv.ouv_id, {
          motivo_id: motivoId || undefined,
          motivo_detalle: motivoDetalle.trim() || undefined,
          monto_final: monto,
          moneda_final: monedaFinal,
        });
      } else if (resultado === 'Perdida') {
        if (motivosPerdida.length > 0 && !motivoId) {
          throw new Error('Selecciona un motivo de pérdida.');
        }
        if (observacionRequired && !motivoDetalle.trim()) {
          throw new Error('Registra una observación de la pérdida.');
        }
        const montoFromField = parseAmountInputEsCo(montoPerdido);
        const montoFromBudget = parseAmountInputEsCo(presupuestoAmount(ouv));
        const monto = montoFromField ?? montoFromBudget;
        if (monto === null || monto < 0) {
          throw new Error('Monto estimado perdido inválido.');
        }
        if (needsCompetidor && !competidor.trim()) {
          throw new Error('Indica el competidor ganador.');
        }
        closed = await perderOuv(ouv.ouv_id, {
          motivo_id: motivoId || undefined,
          motivo_detalle: motivoDetalle.trim() || undefined,
          monto_estimado_perdido: monto,
          competidor_ganador: competidor.trim() || undefined,
        });
      } else {
        if (!motivoId) throw new Error('Selecciona un motivo de descarte.');
        if (selected?.requiere_detalle && !motivoDetalle.trim()) {
          throw new Error('El detalle del motivo es obligatorio.');
        }
        closed = await descartarOuv(ouv.ouv_id, {
          motivo_id: motivoId,
          motivo_detalle: motivoDetalle.trim() || undefined,
        });
      }
      onClosed({ resultado, ouv: closed });
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
    <ModalShell title="Cerrar OUV" onClose={onClose} size="wide">
      <form onSubmit={(e) => void confirm(e)}>
        <div className="mb-4 flex flex-wrap gap-2">
          {(['Ganada', 'Perdida', 'Descartada'] as ResultadoCierre[]).map(
            (r) => (
              <button
                key={r}
                type="button"
                className={
                  resultado === r ? primaryButtonClass : ghostButtonClass
                }
                onClick={() => {
                  setResultado(r);
                  setMotivoId('');
                  setMotivoDetalle('');
                  setError(null);
                  if (r === 'Perdida') {
                    setMontoPerdido(presupuestoAmount(ouv));
                  }
                }}
              >
                {r}
              </button>
            ),
          )}
        </div>

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
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(e) =>
                    setMontoFinal(formatAmountInputEsCo(e.target.value))
                  }
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
            <div>
              <label className={labelClass} htmlFor="cierre-motivo-perdida">
                Motivo
              </label>
              <select
                id="cierre-motivo-perdida"
                className={inputClass}
                value={motivoId}
                onChange={(e) => setMotivoId(e.target.value)}
                required={motivosPerdida.length > 0}
                disabled={motivosPerdida.length === 0}
              >
                <option value="">
                  {motivosPerdida.length === 0
                    ? 'Sin motivos parametrizados'
                    : 'Selecciona…'}
                </option>
                {motivosPerdida.map((m) => (
                  <option key={m.motivo_id} value={m.motivo_id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              {motivosPerdida.length === 0 ? (
                <p className="mt-1 text-xs text-muted">
                  No hay opciones en el catálogo. Completa la observación para
                  cerrar.
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelClass} htmlFor="cierre-monto-perdido">
                Monto estimado perdido
              </label>
              <input
                id="cierre-monto-perdido"
                className={inputClass}
                value={montoPerdido}
                inputMode="decimal"
                autoComplete="off"
                onChange={(e) =>
                  setMontoPerdido(formatAmountInputEsCo(e.target.value))
                }
                required
              />
              {presupuestoAmount(ouv) ? (
                <p className="mt-1 text-xs text-muted">
                  Precargado desde Presupuesto
                  {ouv.presupuesto_moneda
                    ? ` (${ouv.presupuesto_moneda})`
                    : ''}
                  .
                </p>
              ) : null}
            </div>
            {needsCompetidor ? (
              <div>
                <label className={labelClass} htmlFor="cierre-competidor">
                  Competidor ganador
                </label>
                <input
                  id="cierre-competidor"
                  className={inputClass}
                  value={competidor}
                  onChange={(e) => setCompetidor(e.target.value)}
                  required
                />
              </div>
            ) : null}
            <div>
              <label className={labelClass} htmlFor="cierre-observacion">
                Observación
              </label>
              <textarea
                id="cierre-observacion"
                className={`${inputClass} h-20 py-2`}
                value={motivoDetalle}
                onChange={(e) => setMotivoDetalle(e.target.value)}
                required={observacionRequired}
                placeholder="Contexto adicional de la pérdida"
              />
            </div>
          </div>
        ) : null}

        {resultado === 'Descartada' ? (
          <div>
            <label className={labelClass}>Motivo</label>
            <select
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
          </div>
        ) : null}

        {showDetalle ? (
          <div className="mt-3">
            <label className={labelClass}>Detalle del motivo</label>
            <textarea
              className={`${inputClass} h-20 py-2`}
              value={motivoDetalle}
              onChange={(e) => setMotivoDetalle(e.target.value)}
              required={Boolean(selected?.requiere_detalle)}
            />
          </div>
        ) : null}

        {catalogError ? (
          <p className="mt-3 text-sm text-danger">{catalogError}</p>
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
