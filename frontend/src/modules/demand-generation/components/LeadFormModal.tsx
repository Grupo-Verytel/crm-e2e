import { useState } from 'react';
import type { FormEvent } from 'react';
import { createLead } from '../api/leads-api';
import {
  ORIGENES_LEAD,
  SEGMENTOS,
  TIPOS_LEAD,
  type CreateLeadPayload,
  type Lead,
  type OrigenLead,
  type Segmento,
  type TipoLead,
} from '../types';
import { ModalShell } from './ModalShell';
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './ui';

type FormState = {
  tipo_lead: TipoLead;
  origen: OrigenLead;
  segmento: Segmento;
  industria: string;
  region: string;
  pais: string;
  empresa_nombre: string;
  contacto_nombre: string;
  email: string;
  telefono: string;
  nit: string;
};

const initialState: FormState = {
  tipo_lead: 'Inbound',
  origen: 'Web',
  segmento: 'Gobierno',
  industria: '',
  region: '',
  pais: 'CO',
  empresa_nombre: '',
  contacto_nombre: '',
  email: '',
  telefono: '',
  nit: '',
};

export function LeadFormModal({
  responsableId,
  onCreated,
  onClose,
}: {
  responsableId: string;
  onCreated: (lead: Lead) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload: CreateLeadPayload = {
      tipo_lead: form.tipo_lead,
      origen: form.origen,
      segmento: form.segmento,
      region: form.region,
      pais: form.pais.toUpperCase(),
      empresa_nombre: form.empresa_nombre,
      contacto_nombre: form.contacto_nombre,
      email: form.email,
      responsable_id: responsableId,
      ...(form.segmento === 'B2B' && form.industria
        ? { industria: form.industria }
        : {}),
      ...(form.telefono ? { telefono: form.telefono } : {}),
      ...(form.nit ? { nit: form.nit } : {}),
    };

    try {
      const lead = await createLead(payload);
      onCreated(lead);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo crear el lead.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell title="Nuevo lead" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de lead">
            <select
              value={form.tipo_lead}
              onChange={(event) => update('tipo_lead', event.target.value as TipoLead)}
              className={inputClass}
            >
              {TIPOS_LEAD.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Origen">
            <select
              value={form.origen}
              onChange={(event) => update('origen', event.target.value as OrigenLead)}
              className={inputClass}
            >
              {ORIGENES_LEAD.map((origen) => (
                <option key={origen} value={origen}>
                  {origen}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Segmento">
            <select
              value={form.segmento}
              onChange={(event) => update('segmento', event.target.value as Segmento)}
              className={inputClass}
            >
              {SEGMENTOS.map((segmento) => (
                <option key={segmento} value={segmento}>
                  {segmento}
                </option>
              ))}
            </select>
          </Field>
          {form.segmento === 'B2B' ? (
            <Field label="Industria (requerida para B2B)">
              <input
                value={form.industria}
                onChange={(event) => update('industria', event.target.value)}
                className={inputClass}
              />
            </Field>
          ) : (
            <div />
          )}
          <Field label="Empresa">
            <input
              value={form.empresa_nombre}
              onChange={(event) => update('empresa_nombre', event.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Contacto">
            <input
              value={form.contacto_nombre}
              onChange={(event) => update('contacto_nombre', event.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Teléfono">
            <input
              value={form.telefono}
              onChange={(event) => update('telefono', event.target.value)}
              className={inputClass}
              placeholder="3001234567"
            />
          </Field>
          <Field label="Región">
            <input
              value={form.region}
              onChange={(event) => update('region', event.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label="País (ISO-2)">
            <input
              value={form.pais}
              onChange={(event) => update('pais', event.target.value)}
              className={inputClass}
              maxLength={2}
              required
            />
          </Field>
          <Field label="NIT">
            <input
              value={form.nit}
              onChange={(event) => update('nit', event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            Crear lead
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      {children}
    </div>
  );
}
