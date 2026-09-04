import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '../../auth/types';
import {
  crearProyectoPmo,
  type CrearProyectoPmoPayload,
  type ProyectoPmoCreado,
  type TipoProyecto,
} from '../api/projects-api';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  selectClass,
} from './ui';

const TIPOS: { value: TipoProyecto; label: string }[] = [
  { value: 'NON_RECURRING', label: 'No recurrente' },
  { value: 'RECURRING', label: 'Recurrente' },
];

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

/** Convierte `<input type="date">` (YYYY-MM-DD) al ISO 8601 que espera la API. */
function aIso(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toISOString();
}

/**
 * Alta del proyecto de implementación en el PMO (Control Project).
 * Sólo se pide lo que la OUV no puede responder: el nombre y el valor del
 * contrato salen de la OUV si se dejan vacíos.
 */
export function CrearProyectoPmoModal({
  ouvId,
  nombreSugerido,
  onClose,
  onCreated,
}: {
  ouvId: string;
  nombreSugerido: string;
  onClose: () => void;
  onCreated: (proyecto: ProyectoPmoCreado) => void;
}) {
  const [nombreProyecto, setNombreProyecto] = useState(nombreSugerido);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoProyecto, setTipoProyecto] =
    useState<TipoProyecto>('NON_RECURRING');
  const [sharepointUrl, setSharepointUrl] = useState('');
  const [costosEsperados, setCostosEsperados] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fechasInvalidas =
    fechaInicio !== '' && fechaFin !== '' && fechaFin < fechaInicio;
  const puedeGuardar =
    fechaInicio !== '' && fechaFin !== '' && !fechasInvalidas && !saving;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!puedeGuardar) return;

    const payload: CrearProyectoPmoPayload = {
      fechaInicio: aIso(fechaInicio),
      fechaFin: aIso(fechaFin),
      tipoProyecto,
    };

    const nombre = nombreProyecto.trim();
    if (nombre) payload.nombreProyecto = nombre;
    if (sharepointUrl.trim()) payload.sharepointUrl = sharepointUrl.trim();
    if (costosEsperados.trim()) {
      payload.costosEsperados = Number(costosEsperados);
    }

    setSaving(true);
    setError(null);

    try {
      onCreated(await crearProyectoPmo(ouvId, payload));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo crear el proyecto en el PMO.',
      );
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crear proyecto en el PMO"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded bg-surface p-6 shadow-card"
      >
        <div className="mb-4">
          <h2 className="text-base font-bold text-ink">
            Crear proyecto en el PMO
          </h2>
        </div>

        <div className="space-y-3">
          <Campo label="Nombre del proyecto">
            <input
              className={inputClass}
              value={nombreProyecto}
              maxLength={255}
              onChange={(e) => setNombreProyecto(e.target.value)}
            />
          </Campo>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Fecha de inicio">
              <input
                type="date"
                required
                className={inputClass}
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </Campo>
            <Campo label="Fecha de fin">
              <input
                type="date"
                required
                className={inputClass}
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </Campo>
          </div>

          <Campo label="Tipo de proyecto">
            <select
              className={selectClass}
              value={tipoProyecto}
              onChange={(e) =>
                setTipoProyecto(e.target.value as TipoProyecto)
              }
            >
              {TIPOS.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="URL de SharePoint (opcional)">
            <input
              type="url"
              className={inputClass}
              value={sharepointUrl}
              maxLength={500}
              onChange={(e) => setSharepointUrl(e.target.value)}
            />
          </Campo>

          <Campo label="Costos esperados (opcional)">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={costosEsperados}
              onChange={(e) => setCostosEsperados(e.target.value)}
            />
          </Campo>

          <p className="text-xs text-muted">
            El valor del contrato se toma del monto final de la OUV. La compañía,
            el supervisor, el responsable y el estado inicial los asigna el PMO.
          </p>
        </div>

        {fechasInvalidas ? (
          <p className="mt-3 text-sm text-danger">
            La fecha de fin no puede ser anterior a la de inicio.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={!puedeGuardar}
          >
            {saving ? 'Creando…' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </div>
  );
}
