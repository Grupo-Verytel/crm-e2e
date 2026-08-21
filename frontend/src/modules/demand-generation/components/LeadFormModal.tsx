import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  createAccount,
  createPerson,
  fetchAccounts,
  fetchPeople,
} from '../../accounts/api/accounts-api';
import type { Account, Person } from '../../accounts/types';
import { createLead } from '../api/leads-api';
import { fetchSegments } from '../api/segments-api';
import { fetchTraductorReferrers } from '../api/traductores-api';
import type { User } from '../../auth/types';
import {
  CANALES_ORIGEN,
  ORIGENES_LEAD,
  SEGMENTOS,
  TIPOS_LEAD,
  type CanalOrigen,
  type CreateLeadChecklistInput,
  type CreateLeadPayload,
  type Lead,
  type LeadFormMode,
  type OrigenLead,
  type Segment,
  type Segmento,
  type TipoLead,
} from '../types';
import { CANAL_ORIGEN_LABEL } from '../lib/lead-vocab';
import { ModalShell } from './ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

const SEGMENT_NAME_TO_ENUM: Record<string, Segmento> = {
  Gobierno: 'Gobierno',
  'D&S': 'D&S',
  'Proyectos Especiales': 'ProyectosEspeciales',
  B2B: 'B2B',
};

const CHECKLIST_CRITERIA: {
  key: keyof CreateLeadChecklistInput;
  label: string;
}[] = [
  { key: 'criterio_sector_objetivo', label: '¿Pertenece al sector/industria objetivo?' },
  {
    key: 'criterio_necesidad_portafolio',
    label: '¿Necesidad alineada al portafolio Frisson/Verytel?',
  },
  {
    key: 'criterio_acceso_decisor',
    label: '¿Acceso a decisor o influencia hacia el decisor?',
  },
  {
    key: 'criterio_presupuesto_indicios',
    label: '¿Indicios de presupuesto o capacidad de inversión?',
  },
];

type FormState = {
  tipo_lead: TipoLead;
  origen: OrigenLead;
  canal_origen: CanalOrigen;
  segmento: Segmento;
  segment_id: string;
  subsegment_id: string;
  industria: string;
  region: string;
  pais: string;
  business_referrer_id: string;
};

type ContactSlot = {
  person_id: string | null;
  label: string;
};

type NewPersonDraft = {
  name: string;
  job_title: string;
  email: string;
  phone: string;
};

const emptyChecklist = (): CreateLeadChecklistInput => ({
  criterio_sector_objetivo: false,
  criterio_necesidad_portafolio: false,
  criterio_acceso_decisor: false,
  criterio_presupuesto_indicios: false,
});

const initialState: FormState = {
  tipo_lead: 'Inbound',
  origen: 'Web',
  canal_origen: 'CAMPANA_DIGITAL',
  segmento: 'Gobierno',
  segment_id: '',
  subsegment_id: '',
  industria: '',
  region: '',
  pais: 'CO',
  business_referrer_id: '',
};

function canalOptionsForMode(mode: LeadFormMode): CanalOrigen[] {
  if (mode === 'product_manager') {
    return ['BTL', 'FABRICA'];
  }
  if (mode === 'ejecutivo') {
    return ['BTL', 'FABRICA', 'TRADUCTOR_NEGOCIO'];
  }
  return CANALES_ORIGEN;
}

function defaultCanalForMode(mode: LeadFormMode): CanalOrigen {
  if (mode === 'standard') {
    return 'CAMPANA_DIGITAL';
  }
  return 'BTL';
}

function modalTitle(mode: LeadFormMode): string {
  if (mode === 'ejecutivo') {
    return 'Nuevo lead directo';
  }
  if (mode === 'product_manager') {
    return 'Nuevo lead (Product Manager)';
  }
  return 'Nuevo lead';
}

export function LeadFormModal({
  mode = 'standard',
  responsableId,
  onCreated,
  onClose,
}: {
  mode?: LeadFormMode;
  responsableId: string;
  onCreated: (lead: Lead) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => ({
    ...initialState,
    canal_origen: defaultCanalForMode(mode),
  }));
  const [segments, setSegments] = useState<Segment[]>([]);
  const [traductores, setTraductores] = useState<User[]>([]);
  const [checklist, setChecklist] = useState<CreateLeadChecklistInput>(emptyChecklist);

  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountQuery, setAccountQuery] = useState('');
  const [accountHits, setAccountHits] = useState<Account[]>([]);
  const [accountSearching, setAccountSearching] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountTaxId, setNewAccountTaxId] = useState('');

  const [contacts, setContacts] = useState<ContactSlot[]>([
    { person_id: null, label: '' },
  ]);
  const [expandedContact, setExpandedContact] = useState(0);
  const [personQuery, setPersonQuery] = useState('');
  const [personHits, setPersonHits] = useState<Person[]>([]);
  const [personSearching, setPersonSearching] = useState(false);
  const [creatingPersonFor, setCreatingPersonFor] = useState<number | null>(null);
  const [newPerson, setNewPerson] = useState<NewPersonDraft>({
    name: '',
    job_title: '',
    email: '',
    phone: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canalOptions = canalOptionsForMode(mode);
  const selectedSegment = segments.find((segment) => segment.id === form.segment_id);
  const requiresChecklist = mode === 'product_manager' || mode === 'ejecutivo';
  const showTraductorSelect =
    mode === 'ejecutivo' && form.canal_origen === 'TRADUCTOR_NEGOCIO';

  useEffect(() => {
    let active = true;
    void fetchSegments()
      .then((data) => {
        if (active) {
          setSegments(data);
        }
      })
      .catch(() => {
        /* segment selects are optional while ENUM coexistence remains */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showTraductorSelect) {
      return;
    }
    let active = true;
    void fetchTraductorReferrers()
      .then((data) => {
        if (active) {
          setTraductores(data);
        }
      })
      .catch(() => {
        if (active) {
          setTraductores([]);
        }
      });
    return () => {
      active = false;
    };
  }, [showTraductorSelect]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function syncSegmentoFromId(segmentId: string) {
    const segment = segments.find((item) => item.id === segmentId);
    if (!segment) {
      return;
    }
    const enumValue = SEGMENT_NAME_TO_ENUM[segment.name];
    if (enumValue) {
      setForm((prev) => ({
        ...prev,
        segment_id: segmentId,
        subsegment_id: '',
        segmento: enumValue,
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      segment_id: segmentId,
      subsegment_id: '',
    }));
  }

  async function searchAccounts() {
    const q = accountQuery.trim();
    if (!q) {
      setAccountHits([]);
      return;
    }
    setAccountSearching(true);
    try {
      const data = await fetchAccounts({ q, page: 1, limit: 10 });
      setAccountHits(data.items);
    } catch {
      setAccountHits([]);
    } finally {
      setAccountSearching(false);
    }
  }

  async function handleCreateAccount() {
    if (!newAccountName.trim()) {
      setError('Indica el nombre de la empresa.');
      return;
    }
    setError(null);
    try {
      const account = await createAccount({
        name: newAccountName.trim(),
        tax_id: newAccountTaxId.trim() || null,
      });
      setSelectedAccount(account);
      setAccountHits([]);
      setShowCreateAccount(false);
      setNewAccountName('');
      setNewAccountTaxId('');
      setContacts([{ person_id: null, label: '' }]);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'No se pudo crear la empresa.',
      );
    }
  }

  function selectAccount(account: Account) {
    setSelectedAccount(account);
    setAccountHits([]);
    setAccountQuery('');
    setContacts([{ person_id: null, label: '' }]);
    setExpandedContact(0);
  }

  async function searchPeople() {
    if (!selectedAccount) {
      return;
    }
    const q = personQuery.trim();
    setPersonSearching(true);
    try {
      const data = await fetchPeople({
        q: q || undefined,
        account_id: selectedAccount.account_id,
        page: 1,
        limit: 10,
      });
      setPersonHits(data.items);
    } catch {
      setPersonHits([]);
    } finally {
      setPersonSearching(false);
    }
  }

  function selectPerson(index: number, person: Person) {
    setContacts((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index
          ? {
              person_id: person.person_id,
              label: `${person.name}${person.email ? ` · ${person.email}` : ''}`,
            }
          : slot,
      ),
    );
    setPersonHits([]);
    setPersonQuery('');
    setCreatingPersonFor(null);
  }

  async function handleCreatePerson(index: number) {
    if (!selectedAccount) {
      setError('Selecciona una empresa antes de crear contactos.');
      return;
    }
    if (!newPerson.name.trim()) {
      setError('Indica el nombre del contacto.');
      return;
    }
    setError(null);
    try {
      const person = await createPerson({
        name: newPerson.name.trim(),
        job_title: newPerson.job_title.trim() || null,
        email: newPerson.email.trim() || null,
        phone: newPerson.phone.trim() || null,
        account_id: selectedAccount.account_id,
      });
      selectPerson(index, person);
      setNewPerson({ name: '', job_title: '', email: '', phone: '' });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'No se pudo crear el contacto.',
      );
    }
  }

  function addContact() {
    if (contacts.length >= 3) {
      return;
    }
    setContacts((current) => [...current, { person_id: null, label: '' }]);
    setExpandedContact(contacts.length);
  }

  function removeContact(index: number) {
    setContacts((current) =>
      current.length > 1
        ? current.filter((_, contactIndex) => contactIndex !== index)
        : current,
    );
    setExpandedContact((current) => {
      if (current === index) {
        return 0;
      }
      return current > index ? current - 1 : current;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedAccount) {
      setError('Selecciona o crea una empresa para los contactos.');
      return;
    }

    const missingContactIndex = contacts.findIndex((contact) => !contact.person_id);
    if (missingContactIndex >= 0) {
      setExpandedContact(missingContactIndex);
      setError(
        `Selecciona o crea el contacto ${missingContactIndex + 1} en la empresa "${selectedAccount.name}".`,
      );
      return;
    }

    if (requiresChecklist) {
      const allChecked = CHECKLIST_CRITERIA.every(({ key }) => checklist[key]);
      if (!allChecked) {
        setError('Marca los cuatro criterios del checklist para crear el lead.');
        return;
      }
    }

    if (showTraductorSelect && !form.business_referrer_id) {
      setError('Selecciona el traductor de negocio referente.');
      return;
    }

    setIsSubmitting(true);

    const payload: CreateLeadPayload = {
      tipo_lead: form.tipo_lead,
      origen: form.origen,
      canal_origen: form.canal_origen,
      segmento: form.segmento,
      region: form.region,
      pais: form.pais.toUpperCase(),
      contacts: contacts.map((contact) => ({
        person_id: contact.person_id!,
      })),
      responsable_id: responsableId,
      ...(form.segment_id ? { segment_id: form.segment_id } : {}),
      ...(form.subsegment_id ? { subsegment_id: form.subsegment_id } : {}),
      ...(form.segmento === 'B2B' && form.industria
        ? { industria: form.industria }
        : {}),
      ...(selectedAccount.tax_id ? { nit: selectedAccount.tax_id } : {}),
      ...(showTraductorSelect && form.business_referrer_id
        ? { business_referrer_id: form.business_referrer_id }
        : {}),
      ...(requiresChecklist ? { checklist } : {}),
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
    <ModalShell title={modalTitle(mode)} onClose={onClose} size="wide">
      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="space-y-3" aria-labelledby="lead-account-title">
          <h3 id="lead-account-title" className="text-sm font-bold text-ink">
            Empresa (cuenta)
          </h3>
          <p className="text-xs text-muted">
            Todos los contactos deben pertenecer a la misma empresa.
          </p>

          {selectedAccount ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-bg px-4 py-3">
              <div>
                <p className="text-sm font-bold text-ink">{selectedAccount.name}</p>
                {selectedAccount.tax_id ? (
                  <p className="text-xs text-muted">NIT: {selectedAccount.tax_id}</p>
                ) : null}
              </div>
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => {
                  setSelectedAccount(null);
                  setContacts([{ person_id: null, label: '' }]);
                }}
              >
                Cambiar empresa
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded border border-border bg-bg p-4">
              <div className="flex flex-wrap gap-2">
                <input
                  value={accountQuery}
                  onChange={(event) => setAccountQuery(event.target.value)}
                  className={`${inputClass} min-w-[200px] flex-1`}
                  placeholder="Buscar por nombre o NIT"
                />
                <button
                  type="button"
                  onClick={() => void searchAccounts()}
                  disabled={accountSearching}
                  className={ghostButtonClass}
                >
                  {accountSearching ? 'Buscando…' : 'Buscar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateAccount((value) => !value)}
                  className={ghostButtonClass}
                >
                  {showCreateAccount ? 'Cancelar creación' : 'Crear empresa'}
                </button>
              </div>

              {accountHits.length > 0 ? (
                <ul className="divide-y divide-border rounded border border-border bg-surface">
                  {accountHits.map((account) => (
                    <li key={account.account_id}>
                      <button
                        type="button"
                        onClick={() => selectAccount(account)}
                        className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-bg"
                      >
                        <span className="font-bold text-ink">{account.name}</span>
                        {account.tax_id ? (
                          <span className="text-xs text-muted">
                            NIT: {account.tax_id}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {showCreateAccount ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Nombre de empresa">
                    <input
                      value={newAccountName}
                      onChange={(event) => setNewAccountName(event.target.value)}
                      className={inputClass}
                      maxLength={120}
                      required
                    />
                  </Field>
                  <Field label="NIT (opcional)">
                    <input
                      value={newAccountTaxId}
                      onChange={(event) => setNewAccountTaxId(event.target.value)}
                      className={inputClass}
                      maxLength={20}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => void handleCreateAccount()}
                      className={primaryButtonClass}
                    >
                      Guardar empresa
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="lead-data-title">
          <h3 id="lead-data-title" className="text-sm font-bold text-ink">
            Datos del lead
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Canal de origen">
              <select
                value={form.canal_origen}
                onChange={(event) =>
                  update('canal_origen', event.target.value as CanalOrigen)
                }
                className={inputClass}
                required
              >
                {canalOptions.map((canal) => (
                  <option key={canal} value={canal}>
                    {CANAL_ORIGEN_LABEL[canal]}
                  </option>
                ))}
              </select>
            </Field>

            {showTraductorSelect ? (
              <Field label="Traductor de negocio referente">
                <select
                  value={form.business_referrer_id}
                  onChange={(event) =>
                    update('business_referrer_id', event.target.value)
                  }
                  className={inputClass}
                  required
                >
                  <option value="">
                    {traductores.length === 0
                      ? 'Sin traductores activos disponibles'
                      : 'Seleccionar traductor'}
                  </option>
                  {traductores.map((traductor) => (
                    <option key={traductor.user_id} value={traductor.user_id}>
                      {traductor.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label="Segmento (catálogo)">
              <select
                value={form.segment_id}
                onChange={(event) => syncSegmentoFromId(event.target.value)}
                className={inputClass}
              >
                <option value="">Usar segmento legacy</option>
                {segments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </Field>

            {selectedSegment && selectedSegment.subsegments.length > 0 ? (
              <Field label="Subsegmento">
                <select
                  value={form.subsegment_id}
                  onChange={(event) =>
                    update('subsegment_id', event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Sin subsegmento</option>
                  {selectedSegment.subsegments.map((subsegment) => (
                    <option key={subsegment.id} value={subsegment.id}>
                      {subsegment.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label="Segmento (legacy)">
              <select
                value={form.segmento}
                onChange={(event) =>
                  update('segmento', event.target.value as Segmento)
                }
                className={inputClass}
                required
              >
                {SEGMENTOS.map((segmento) => (
                  <option key={segmento} value={segmento}>
                    {segmento}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tipo de lead">
              <select
                value={form.tipo_lead}
                onChange={(event) =>
                  update('tipo_lead', event.target.value as TipoLead)
                }
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
                onChange={(event) =>
                  update('origen', event.target.value as OrigenLead)
                }
                className={inputClass}
              >
                {ORIGENES_LEAD.map((origen) => (
                  <option key={origen} value={origen}>
                    {origen}
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
                  required
                />
              </Field>
            ) : null}

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
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="lead-contacts-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3
                id="lead-contacts-title"
                className="text-sm font-bold text-ink"
              >
                Contactos
              </h3>
              <p className="text-xs text-muted">
                Registra entre 1 y 3 contactos de la misma empresa. El primero
                será el principal.
              </p>
            </div>
            <button
              type="button"
              onClick={addContact}
              disabled={!selectedAccount || contacts.length >= 3}
              className={ghostButtonClass}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus size={15} strokeWidth={1.75} />
                Agregar contacto
              </span>
            </button>
          </div>

          {!selectedAccount ? (
            <p className="text-sm text-muted">
              Selecciona una empresa para buscar o crear contactos.
            </p>
          ) : null}

          {contacts.map((contact, index) => {
            const isExpanded =
              contacts.length === 1 || expandedContact === index;

            return (
              <div key={index} className="rounded border border-border bg-bg">
                <div
                  className={[
                    'flex items-center justify-between gap-2 px-4 py-3',
                    isExpanded ? 'border-b border-border' : '',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedContact(index)}
                    className="btn-glow-outline flex min-w-0 flex-1 items-center gap-2 rounded border-transparent px-2 py-1 text-left text-sm font-bold"
                    aria-expanded={isExpanded}
                    aria-controls={`lead-contact-${index}`}
                    disabled={contacts.length === 1}
                  >
                    {contacts.length > 1 ? (
                      isExpanded ? (
                        <ChevronDown size={16} strokeWidth={1.75} />
                      ) : (
                        <ChevronRight size={16} strokeWidth={1.75} />
                      )
                    ) : null}
                    <span>
                      {index === 0
                        ? 'Contacto principal'
                        : `Contacto ${index + 1}`}
                    </span>
                    {!isExpanded && contact.label ? (
                      <span className="truncate text-xs font-normal text-muted">
                        {contact.label}
                      </span>
                    ) : null}
                  </button>
                  {contacts.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeContact(index)}
                      className="btn-glow-outline inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-bold"
                      aria-label={`Eliminar contacto ${index + 1}`}
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                      Eliminar
                    </button>
                  ) : null}
                </div>

                {isExpanded && selectedAccount ? (
                  <div
                    id={`lead-contact-${index}`}
                    className="space-y-3 p-4"
                  >
                    {contact.person_id ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-surface px-3 py-2">
                        <p className="text-sm text-ink">{contact.label}</p>
                        <button
                          type="button"
                          className={ghostButtonClass}
                          onClick={() =>
                            setContacts((current) =>
                              current.map((slot, slotIndex) =>
                                slotIndex === index
                                  ? { person_id: null, label: '' }
                                  : slot,
                              ),
                            )
                          }
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <input
                            value={personQuery}
                            onChange={(event) =>
                              setPersonQuery(event.target.value)
                            }
                            className={`${inputClass} min-w-[200px] flex-1`}
                            placeholder="Buscar contacto en esta empresa"
                          />
                          <button
                            type="button"
                            onClick={() => void searchPeople()}
                            disabled={personSearching}
                            className={ghostButtonClass}
                          >
                            {personSearching ? 'Buscando…' : 'Buscar'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCreatingPersonFor(
                                creatingPersonFor === index ? null : index,
                              )
                            }
                            className={ghostButtonClass}
                          >
                            {creatingPersonFor === index
                              ? 'Cancelar creación'
                              : 'Crear contacto'}
                          </button>
                        </div>

                        {personHits.length > 0 ? (
                          <ul className="divide-y divide-border rounded border border-border bg-surface">
                            {personHits.map((person) => (
                              <li key={person.person_id}>
                                <button
                                  type="button"
                                  onClick={() => selectPerson(index, person)}
                                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-bg"
                                >
                                  <span className="font-bold text-ink">
                                    {person.name}
                                  </span>
                                  <span className="text-xs text-muted">
                                    {[person.job_title, person.email, person.phone]
                                      .filter(Boolean)
                                      .join(' · ') || 'Sin datos adicionales'}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {creatingPersonFor === index ? (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field label="Nombre">
                              <input
                                value={newPerson.name}
                                onChange={(event) =>
                                  setNewPerson((prev) => ({
                                    ...prev,
                                    name: event.target.value,
                                  }))
                                }
                                className={inputClass}
                                maxLength={120}
                                required
                              />
                            </Field>
                            <Field label="Cargo">
                              <input
                                value={newPerson.job_title}
                                onChange={(event) =>
                                  setNewPerson((prev) => ({
                                    ...prev,
                                    job_title: event.target.value,
                                  }))
                                }
                                className={inputClass}
                                maxLength={80}
                              />
                            </Field>
                            <Field label="Correo">
                              <input
                                type="email"
                                value={newPerson.email}
                                onChange={(event) =>
                                  setNewPerson((prev) => ({
                                    ...prev,
                                    email: event.target.value,
                                  }))
                                }
                                className={inputClass}
                                maxLength={180}
                              />
                            </Field>
                            <Field label="Teléfono">
                              <input
                                type="tel"
                                value={newPerson.phone}
                                onChange={(event) =>
                                  setNewPerson((prev) => ({
                                    ...prev,
                                    phone: event.target.value,
                                  }))
                                }
                                className={inputClass}
                                maxLength={20}
                              />
                            </Field>
                            <div className="sm:col-span-2">
                              <button
                                type="button"
                                onClick={() => void handleCreatePerson(index)}
                                className={primaryButtonClass}
                              >
                                Guardar contacto
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>

        {requiresChecklist ? (
          <section className="space-y-3" aria-labelledby="lead-checklist-title">
            <h3 id="lead-checklist-title" className="text-sm font-bold text-ink">
              Checklist de calificación (obligatorio)
            </h3>
            <div className="space-y-2 rounded border border-border bg-bg p-4">
              {CHECKLIST_CRITERIA.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-2 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    checked={checklist[key]}
                    onChange={(event) =>
                      setChecklist((prev) => ({
                        ...prev,
                        [key]: event.target.checked,
                      }))
                    }
                    className="mt-0.5"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>
        ) : null}

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
            Crear lead
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      {children}
    </div>
  );
}
