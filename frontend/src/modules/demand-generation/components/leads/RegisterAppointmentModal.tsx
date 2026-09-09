import { useState, type FormEvent } from 'react';
import type { ApproveAgencyMqlPayload, Lead } from '../../types';
import { ModalShell } from '../ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../ui';

export type { ApproveAgencyMqlPayload };

export function RegisterAppointmentModal({
  lead,
  title = 'Cita para aprobar SQL',
  submitLabel = 'Aprobar → SQL',
  onConfirm,
  onClose,
}: {
  lead: Lead;
  title?: string;
  submitLabel?: string;
  onConfirm: (payload: ApproveAgencyMqlPayload) => Promise<void>;
  onClose: () => void;
}) {
  const [fechaCita, setFechaCita] = useState('');
  const [contactoNombre, setContactoNombre] = useState(lead.contacto_nombre ?? '');
  const [contactoEmail, setContactoEmail] = useState(lead.email ?? '');
  const [contactoTelefono, setContactoTelefono] = useState(lead.telefono ?? '');
  const [lugar, setLugar] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: ApproveAgencyMqlPayload = {
        fecha_cita: new Date(fechaCita).toISOString(),
        cita_contacto_nombre: contactoNombre.trim(),
        cita_contacto_email: contactoEmail.trim(),
        cita_contacto_telefono: contactoTelefono.trim(),
        ...(lugar.trim() ? { cita_lugar: lugar.trim() } : {}),
      };
      await onConfirm(payload);
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
            Fecha de la cita y hora
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

        <fieldset className="space-y-3">
          <legend className={labelClass}>Contacto principal</legend>
          <div>
            <label htmlFor="cita-contacto-nombre" className={labelClass}>
              Nombre
            </label>
            <input
              id="cita-contacto-nombre"
              value={contactoNombre}
              onChange={(event) => setContactoNombre(event.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="cita-contacto-email" className={labelClass}>
              Correo
            </label>
            <input
              id="cita-contacto-email"
              type="email"
              value={contactoEmail}
              onChange={(event) => setContactoEmail(event.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="cita-contacto-telefono" className={labelClass}>
              Teléfono
            </label>
            <input
              id="cita-contacto-telefono"
              type="tel"
              value={contactoTelefono}
              onChange={(event) => setContactoTelefono(event.target.value)}
              className={inputClass}
              required
            />
          </div>
        </fieldset>

        <div>
          <label htmlFor="cita-lugar" className={labelClass}>
            Lugar de la cita (opcional)
          </label>
          <input
            id="cita-lugar"
            value={lugar}
            onChange={(event) => setLugar(event.target.value)}
            className={inputClass}
          />
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={primaryButtonClass}
          >
            {isSubmitting ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
