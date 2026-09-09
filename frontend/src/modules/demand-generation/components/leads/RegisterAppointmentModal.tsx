import { useState, type FormEvent } from 'react';
import {
  parseCitaContactos,
  type CitaContactoInput,
} from '../../lib/cita-contactos';
import type { ApproveAgencyMqlPayload, Lead } from '../../types';
import { ModalShell } from '../ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../ui';
import { CitaContactosFields } from './CitaContactosFields';

export type { ApproveAgencyMqlPayload };

function initialContactos(lead: Lead): CitaContactoInput[] {
  const fromJson = parseCitaContactos(lead.cita_contactos);
  if (fromJson.length > 0) {
    return fromJson;
  }
  return [
    {
      nombre: lead.cita_contacto_nombre || lead.contacto_nombre || '',
      email: lead.cita_contacto_email || lead.email || '',
      telefono: lead.cita_contacto_telefono || lead.telefono || '',
    },
  ];
}

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
  const [contactos, setContactos] = useState<CitaContactoInput[]>(() =>
    initialContactos(lead),
  );
  const [lugar, setLugar] = useState(lead.cita_lugar ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const principal = contactos[0];
    if (!principal) {
      setError('Agrega al menos un contacto para la cita.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: ApproveAgencyMqlPayload = {
        fecha_cita: new Date(fechaCita).toISOString(),
        cita_contactos: contactos.map((contacto) => ({
          nombre: contacto.nombre.trim(),
          email: contacto.email.trim(),
          telefono: contacto.telefono.trim(),
        })),
        cita_contacto_nombre: principal.nombre.trim(),
        cita_contacto_email: principal.email.trim(),
        cita_contacto_telefono: principal.telefono.trim(),
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

        <CitaContactosFields contacts={contactos} onChange={setContactos} />

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
