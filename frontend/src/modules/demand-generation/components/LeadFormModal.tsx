import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createLead } from '../api/leads-api';
import {
  CANALES_ORIGEN,
  ORIGENES_LEAD,
  type CanalOrigen,
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
  canal_origen: CanalOrigen;
  segmento: Segmento;
  industria: string;
  region: string;
  pais: string;
  nit: string;
};

type ContactFormState = {
  empresa_nombre: string;
  nombre: string;
  cargo: string;
  email: string;
  telefono: string;
};

const emptyContact = (): ContactFormState => ({
  empresa_nombre: '',
  nombre: '',
  cargo: '',
  email: '',
  telefono: '',
});

const initialState: FormState = {
  tipo_lead: 'Inbound',
  origen: 'Web',
  canal_origen: 'CAMPANA_DIGITAL',
  segmento: 'Gobierno',
  industria: '',
  region: '',
  pais: 'CO',
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
  const [contacts, setContacts] = useState<ContactFormState[]>([emptyContact()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateContact(
    index: number,
    key: keyof ContactFormState,
    value: string,
  ) {
    setContacts((current) =>
      current.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [key]: value } : contact,
      ),
    );
  }

  function addContact() {
    setContacts((current) =>
      current.length < 3 ? [...current, emptyContact()] : current,
    );
  }

  function removeContact(index: number) {
    setContacts((current) =>
      current.length > 1
        ? current.filter((_, contactIndex) => contactIndex !== index)
        : current,
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload: CreateLeadPayload = {
      tipo_lead: form.tipo_lead,
      origen: form.origen,
      canal_origen: form.canal_origen,
      segmento: form.segmento,
      region: form.region,
      pais: form.pais.toUpperCase(),
      contacts: contacts.map((contact) => ({
        empresa_nombre: contact.empresa_nombre.trim(),
        nombre: contact.nombre.trim(),
        cargo: contact.cargo.trim(),
        email: contact.email.trim(),
        telefono: contact.telefono.trim(),
      })),
      responsable_id: responsableId,
      ...(form.segmento === 'B2B' && form.industria
        ? { industria: form.industria }
        : {}),
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
    <ModalShell title="Nuevo lead" onClose={onClose} size="wide">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <Field label="Canal de origen">
            <select
              value={form.canal_origen}
              onChange={(event) =>
                update('canal_origen', event.target.value as CanalOrigen)
              }
              className={inputClass}
              required
            >
              {CANALES_ORIGEN.map((canal) => (
                <option
                  key={canal}
                  value={canal}
                  disabled={canal === 'TRADUCTOR_NEGOCIO'}
                >
                  {canal.replaceAll('_', ' ')}
                  {canal === 'TRADUCTOR_NEGOCIO' ? ' (TBD)' : ''}
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

        <section className="space-y-3" aria-labelledby="lead-contacts-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 id="lead-contacts-title" className="text-sm font-bold text-ink">
                Contactos
              </h3>
              <p className="text-xs text-muted">
                Registra entre 1 y 3 contactos. El primero será el principal.
              </p>
            </div>
            <button
              type="button"
              onClick={addContact}
              disabled={contacts.length >= 3}
              className={ghostButtonClass}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus size={15} strokeWidth={1.75} />
                Agregar contacto
              </span>
            </button>
          </div>

          {contacts.map((contact, index) => (
            <div
              key={index}
              className="rounded border border-border bg-bg p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-ink">
                  {index === 0 ? 'Contacto principal' : `Contacto ${index + 1}`}
                </p>
                {contacts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeContact(index)}
                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-bold text-danger hover:bg-surface"
                    aria-label={`Eliminar contacto ${index + 1}`}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                    Eliminar
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Empresa">
                  <input
                    value={contact.empresa_nombre}
                    onChange={(event) =>
                      updateContact(index, 'empresa_nombre', event.target.value)
                    }
                    className={inputClass}
                    maxLength={120}
                    required
                  />
                </Field>
                <Field label="Nombre">
                  <input
                    value={contact.nombre}
                    onChange={(event) =>
                      updateContact(index, 'nombre', event.target.value)
                    }
                    className={inputClass}
                    maxLength={120}
                    required
                  />
                </Field>
                <Field label="Cargo">
                  <input
                    value={contact.cargo}
                    onChange={(event) =>
                      updateContact(index, 'cargo', event.target.value)
                    }
                    className={inputClass}
                    maxLength={80}
                    required
                  />
                </Field>
                <Field label="Correo">
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(event) =>
                      updateContact(index, 'email', event.target.value)
                    }
                    className={inputClass}
                    maxLength={180}
                    required
                  />
                </Field>
                <Field label="Teléfono">
                  <input
                    type="tel"
                    value={contact.telefono}
                    onChange={(event) =>
                      updateContact(index, 'telefono', event.target.value)
                    }
                    className={inputClass}
                    maxLength={20}
                    placeholder="3001234567"
                    required
                  />
                </Field>
              </div>
            </div>
          ))}
        </section>

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
