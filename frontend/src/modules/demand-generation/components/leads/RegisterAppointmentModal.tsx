import { useEffect, useState, type FormEvent } from 'react';
import {
  fetchAppointmentCommercials,
  registerLeadAppointment,
} from '../../api/leads-api';
import type { CommercialOption, Lead, RegisterAppointmentPayload } from '../../types';
import { ModalShell } from '../ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../ui';

export function RegisterAppointmentModal({
  lead,
  title = 'Registrar cita agendada',
  submitLabel = 'Registrar cita',
  onRegistered,
  onConfirm,
  onClose,
}: {
  lead: Lead;
  title?: string;
  submitLabel?: string;
  onRegistered?: (lead: Lead) => void;
  onConfirm?: (payload: RegisterAppointmentPayload) => Promise<void>;
  onClose: () => void;
}) {
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [fechaCita, setFechaCita] = useState('');
  const [commercialId, setCommercialId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAppointmentCommercials()
      .then((items) => {
        if (active) {
          setCommercials(items);
          setCommercialId(items[0]?.user_id ?? '');
        }
      })
      .catch(() => {
        if (active) {
          setError('No se pudieron cargar los comerciales.');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: RegisterAppointmentPayload = {
        fecha_cita: new Date(fechaCita).toISOString(),
        comercial_asignado_id: commercialId,
      };
      if (onConfirm) {
        await onConfirm(payload);
      } else if (onRegistered) {
        const updated = await registerLeadAppointment(lead.lead_id, payload);
        onRegistered(updated);
      }
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo registrar la cita.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-muted">
          {lead.contacto_nombre} · {lead.empresa_nombre}
        </p>

        <div>
          <label htmlFor="appointment-date" className={labelClass}>
            Fecha de la cita
          </label>
          <input
            id="appointment-date"
            type="datetime-local"
            value={fechaCita}
            onChange={(event) => setFechaCita(event.target.value)}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label htmlFor="appointment-commercial" className={labelClass}>
            Comercial asignado
          </label>
          <select
            id="appointment-commercial"
            value={commercialId}
            onChange={(event) => setCommercialId(event.target.value)}
            className={inputClass}
            disabled={isLoading}
            required
          >
            {commercials.length === 0 ? (
              <option value="">No hay comerciales disponibles</option>
            ) : null}
            {commercials.map((commercial) => (
              <option key={commercial.user_id} value={commercial.user_id}>
                {commercial.full_name}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isLoading || !commercialId}
            className={primaryButtonClass}
          >
            {isSubmitting ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
