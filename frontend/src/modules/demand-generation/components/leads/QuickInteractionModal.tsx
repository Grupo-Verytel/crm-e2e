import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../../auth/types';
import { registerInteraction } from '../../api/leads-api';
import {
  INTERACTION_MAX_BACKDATE_HOURS,
  interactionFechaBounds,
  toDatetimeLocalValue,
} from '../../lib/interaction-fecha';
import {
  INTERACTION_CANAL_LABEL,
  INTERACTION_TIPO_LABEL,
  INTERACTION_TIPOS,
  canalesForTipo,
  type CreateInteractionPayload,
  type InteractionCanal,
  type InteractionTipo,
} from '../../types';
import { ModalShell } from '../ModalShell';
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from '../ui';

type Props = {
  leadId: string;
  leadName: string;
  onRegistered: () => void | Promise<void>;
  onClose: () => void;
  /** Override intro copy under the title. */
  subtitle?: string;
  submitLabel?: string;
  /** When true, empty description blocks submit. */
  descriptionRequired?: boolean;
  /** When set, the modal does not post to the lead endpoint. */
  register?: (payload: CreateInteractionPayload) => Promise<unknown>;
};

/**
 * Interaction capture modal — used from the kanban nutrition gate and the
 * lead detail Interacciones tab.
 */
export function QuickInteractionModal({
  leadId,
  leadName,
  onRegistered,
  onClose,
  subtitle,
  submitLabel = 'Registrar y mover a nutrición',
  descriptionRequired = false,
  register,
}: Props) {
  const [tipo, setTipo] = useState<InteractionTipo>('Llamada');
  const canales = useMemo(() => canalesForTipo(tipo), [tipo]);
  const [canal, setCanal] = useState<InteractionCanal>(canales[0] ?? 'Telefono');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(() => toDatetimeLocalValue(new Date()));
  const fechaBounds = useMemo(() => interactionFechaBounds(), []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fechaError, setFechaError] = useState<string | null>(null);

  useEffect(() => {
    if (!canales.includes(canal)) {
      setCanal(canales[0] ?? 'Telefono');
    }
  }, [canales, canal]);

  async function handleSubmit() {
    if (descriptionRequired && !descripcion.trim()) {
      setError('La descripción es obligatoria.');
      return;
    }
    if (fecha < fechaBounds.min || fecha > fechaBounds.max) {
      setFechaError(
        `La fecha no puede ser anterior a ${INTERACTION_MAX_BACKDATE_HOURS} horas ni posterior a ahora.`,
      );
      return;
    }
    setIsSaving(true);
    setError(null);
    setFechaError(null);
    try {
      if (register) {
        await register({
          tipo,
          canal,
          descripcion: descripcion.trim() || undefined,
          fecha: new Date(fecha).toISOString(),
        });
      } else {
        await registerInteraction(leadId, {
          tipo,
          canal,
          descripcion: descripcion.trim() || undefined,
          fecha: new Date(fecha).toISOString(),
        });
      }
      await onRegistered();
      onClose();
    } catch (submitError) {
      if (
        submitError instanceof ApiError &&
        submitError.code === 'INTERACTION_DATE_TOO_OLD'
      ) {
        setFechaError(
          `La fecha no puede ser anterior a ${INTERACTION_MAX_BACKDATE_HOURS} horas.`,
        );
        return;
      }
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo registrar la interacción.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalShell title="Registrar interacción" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {subtitle ??
            `${leadName} aún no tiene ninguna interacción. Registra la primera para moverlo a nutrición.`}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="qi-tipo" className={labelClass}>
              Tipo de comunicación
            </label>
            <select
              id="qi-tipo"
              value={tipo}
              onChange={(event) => setTipo(event.target.value as InteractionTipo)}
              className={inputClass}
            >
              {INTERACTION_TIPOS.map((value) => (
                <option key={value} value={value}>
                  {INTERACTION_TIPO_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="qi-canal" className={labelClass}>
              Canal
            </label>
            <select
              id="qi-canal"
              value={canal}
              onChange={(event) =>
                setCanal(event.target.value as InteractionCanal)
              }
              className={inputClass}
            >
              {canales.map((value) => (
                <option key={value} value={value}>
                  {INTERACTION_CANAL_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="qi-fecha" className={labelClass}>
            Fecha y hora
          </label>
          <input
            id="qi-fecha"
            type="datetime-local"
            value={fecha}
            min={fechaBounds.min}
            max={fechaBounds.max}
            onChange={(event) => {
              setFecha(event.target.value);
              setFechaError(null);
            }}
            className={inputClass}
            required
            aria-invalid={fechaError ? true : undefined}
            aria-describedby={fechaError ? 'qi-fecha-error' : undefined}
          />
          {fechaError ? (
            <p id="qi-fecha-error" className="mt-1 text-sm text-danger">
              {fechaError}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="qi-desc" className={labelClass}>
            Descripción{descriptionRequired ? '' : ' (opcional)'}
          </label>
          <textarea
            id="qi-desc"
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            rows={3}
            placeholder="Ej. Llamada inicial: interesado en el portafolio de conectividad."
            className={`${inputClass} h-auto py-2`}
            required={descriptionRequired}
          />
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving}
            className={primaryButtonClass}
          >
            {isSaving ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
