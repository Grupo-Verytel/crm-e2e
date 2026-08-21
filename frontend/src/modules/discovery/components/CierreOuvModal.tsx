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
  onClosed: () => void;
};

export function CierreOuvModal({ ouv, onClose, onClosed }: Props) {
  const [resultado, setResultado] = useState<ResultadoCierre>('Ganada');
  const [motivosPerdida, setMotivosPerdida] = useState<MotivoCatalogo[]>([]);
  const [motivosDescarte, setMotivosDescarte] = useState<MotivoCatalogo[]>(
    [],
  );
  const [motivoId, setMotivoId] = useState('');
  const [motivoDetalle, setMotivoDetalle] = useState('');
  const [montoFinal, setMontoFinal] = useState('');
  const [monedaFinal, setMonedaFinal] = useState('COP');
  const [montoPerdido, setMontoPerdido] = useState('');
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
  const showDetalle =
    Boolean(selected?.requiere_detalle) ||
    (resultado === 'Ganada' && Boolean(motivoId));

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
        const monto = Number(montoPerdido);
        if (!Number.isFinite(monto) || monto < 0) {
          throw new Error('Monto estimado perdido inválido.');
        }
        if (needsCompetidor && !competidor.trim()) {
          throw new Error('Indica el competidor ganador.');
        }
        if (selected?.requiere_detalle && !motivoDetalle.trim()) {
          throw new Error('El detalle del motivo es obligatorio.');
        }
        await perderOuv(ouv.ouv_id, {
          motivo_id: motivoId,
          motivo_detalle: motivoDetalle.trim() || undefined,
          monto_estimado_perdido: monto,
          competidor_ganador: competidor.trim() || undefined,
        });
      } else {
        if (!motivoId) throw new Error('Selecciona un motivo de descarte.');
        if (selected?.requiere_detalle && !motivoDetalle.trim()) {
          throw new Error('El detalle del motivo es obligatorio.');
        }
        await descartarOuv(ouv.ouv_id, {
          motivo_id: motivoId,
          motivo_detalle: motivoDetalle.trim() || undefined,
        });
      }
      onClosed();
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
            <div>
              <label className={labelClass}>Motivo</label>
              <select
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
            </div>
            <div>
              <label className={labelClass}>Monto estimado perdido</label>
              <input
                className={inputClass}
                value={montoPerdido}
                onChange={(e) => setMontoPerdido(e.target.value)}
                required
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
