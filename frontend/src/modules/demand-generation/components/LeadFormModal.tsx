import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import {
  fetchAccounts,
  fetchPeople,
} from '../../accounts/api/accounts-api';
import type { Account, Person } from '../../accounts/types';
import { createLead } from '../api/leads-api';
import { fetchSegments } from '../api/segments-api';
import { fetchTraductorReferrers } from '../api/traductores-api';
import { ColombiaCitySearchField } from '../../discovery/components/ColombiaCitySearchField';
import {
  CANALES_ORIGEN,
  ORIGENES_LEAD,
  type CanalOrigen,
  type CommercialOption,
  type CreateLeadChecklistInput,
  type CreateLeadPayload,
  type Lead,
  type LeadFormMode,
  type OrigenLead,
  type Segment,
  type Segmento,
} from '../types';
import { CANAL_ORIGEN_LABEL, LEAD_INFLUENCIA_SLOTS } from '../lib/lead-vocab';
import type { LeadInfluenciaKey } from '../lib/lead-vocab';
import { ModalShell } from './ModalShell';
import {
  contactTableHeaderClass,
  ghostButtonClass,
  influenceChipClass,
  influenceChipPressedClass,
  influenceTableRowClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

const SEGMENT_NAME_TO_ENUM: Record<string, Segmento> = {
  'Gobierno central': 'Gobierno central',
  'Defensa y seguridad': 'Defensa y seguridad',
  'Ciudades y gobernaciones': 'Ciudades y gobernaciones',
  Industria: 'Industria',
  Gobierno: 'Gobierno central',
  'D&S': 'Defensa y seguridad',
  'Proyectos Especiales': 'Ciudades y gobernaciones',
  ProyectosEspeciales: 'Ciudades y gobernaciones',
  B2B: 'Industria',
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
];

type FormState = {
  origen: OrigenLead;
  canal_origen: CanalOrigen;
  segmento: Segmento;
  segment_id: string;
  subsegment_id: string;
  city: string;
  region: string;
  business_referrer_id: string;
  referrer_name: string;
};

type ContactSlot = {
  slotId: string;
  person_id: string | null;
  label: string;
  tipos_influencia: LeadInfluenciaKey[];
};

const emptyContact = (): ContactSlot => ({
  slotId: crypto.randomUUID(),
  person_id: null,
  label: '',
  tipos_influencia: [],
});

const emptyContactSlots = (): ContactSlot[] => [emptyContact()];

function rowLabel(index: number): string {
  return index === 0 ? 'Principal' : `Contacto ${index + 1}`;
}

const emptyChecklist = (): CreateLeadChecklistInput => ({
  criterio_sector_objetivo: false,
  criterio_necesidad_portafolio: false,
  criterio_acceso_decisor: false,
});

const initialState: FormState = {
  origen: 'Web',
  canal_origen: 'CAMPANA_DIGITAL',
  segmento: 'Gobierno central',
  segment_id: '',
  subsegment_id: '',
  city: '',
  region: '',
  business_referrer_id: '',
  referrer_name: '',
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

function personLabel(person: Person): string {
  const role = person.job_title?.trim();
  return role ? `${person.name} · ${role}` : person.name;
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
  const [traductores, setTraductores] = useState<CommercialOption[]>([]);
  const [checklist, setChecklist] = useState<CreateLeadChecklistInput>(emptyChecklist);

  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [empresaQuery, setEmpresaQuery] = useState('');
  const [nitQuery, setNitQuery] = useState('');
  const [accountHits, setAccountHits] = useState<Account[]>([]);
  const [accountSearching, setAccountSearching] = useState(false);
  const [accountListOpen, setAccountListOpen] = useState(false);
  const accountSearchRef = useRef<HTMLDivElement>(null);

  const [contactSlots, setContactSlots] =
    useState<ContactSlot[]>(emptyContactSlots);
  const [accountPeople, setAccountPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [activePersonSearch, setActivePersonSearch] = useState<number | null>(
    null,
  );
  const [personQuery, setPersonQuery] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canalOptions = canalOptionsForMode(mode);
  const selectedSegment = segments.find((segment) => segment.id === form.segment_id);
  const requiresSubsegment =
    !!selectedSegment &&
    SEGMENT_NAME_TO_ENUM[selectedSegment.name] === 'Industria';
  const requiresChecklist = mode === 'product_manager' || mode === 'ejecutivo';
  const showTraductorSelect = form.canal_origen === 'TRADUCTOR_NEGOCIO';
  const showReferidoName = form.canal_origen === 'REFERIDO';

  const takenPersonIds = useMemo(
    () =>
      new Set(
        contactSlots
          .map((slot) => slot.person_id)
          .filter((id): id is string => Boolean(id)),
      ),
    [contactSlots],
  );

  const filteredPeople = useMemo(() => {
    const available = accountPeople.filter(
      (person) => !takenPersonIds.has(person.person_id),
    );
    const q = personQuery.trim().toLowerCase();
    if (!q) {
      return available;
    }
    return available.filter((person) => {
      const haystack = [person.name, person.email, person.job_title, person.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [accountPeople, personQuery, takenPersonIds]);

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

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!accountSearchRef.current?.contains(event.target as Node)) {
        setAccountListOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  /** Debounced account search by empresa name or NIT. */
  useEffect(() => {
    if (selectedAccount) {
      return;
    }
    const q = (empresaQuery.trim() || nitQuery.trim()).trim();
    if (q.length < 2) {
      setAccountHits([]);
      setAccountSearching(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setAccountSearching(true);
      void fetchAccounts({ q, page: 1, limit: 12 })
        .then((data) => {
          if (!active) {
            return;
          }
          setAccountHits(data.items);
          setAccountListOpen(true);
        })
        .catch(() => {
          if (active) {
            setAccountHits([]);
          }
        })
        .finally(() => {
          if (active) {
            setAccountSearching(false);
          }
        });
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [empresaQuery, nitQuery, selectedAccount]);

  useEffect(() => {
    if (!selectedAccount) {
      setAccountPeople([]);
      setPeopleLoading(false);
      return;
    }
    let active = true;
    setPeopleLoading(true);
    void fetchPeople({
      account_id: selectedAccount.account_id,
      page: 1,
      limit: 100,
    })
      .then((data) => {
        if (active) {
          setAccountPeople(data.items);
        }
      })
      .catch(() => {
        if (active) {
          setAccountPeople([]);
        }
      })
      .finally(() => {
        if (active) {
          setPeopleLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedAccount]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function syncSegmentoFromId(segmentId: string) {
    if (!segmentId) {
      setForm((prev) => ({
        ...prev,
        segment_id: '',
        subsegment_id: '',
      }));
      return;
    }
    const segment = segments.find((item) => item.id === segmentId);
    if (!segment) {
      return;
    }
    const enumValue = SEGMENT_NAME_TO_ENUM[segment.name];
    setForm((prev) => ({
      ...prev,
      segment_id: segmentId,
      subsegment_id: '',
      ...(enumValue ? { segmento: enumValue } : {}),
    }));
  }

  function resetContactDraft() {
    setActivePersonSearch(null);
    setPersonQuery('');
  }

  function clearSelectedAccount() {
    if (!selectedAccount) {
      return;
    }
    setSelectedAccount(null);
    setContactSlots(emptyContactSlots());
    resetContactDraft();
  }

  function selectAccount(account: Account) {
    setSelectedAccount(account);
    setEmpresaQuery(account.name);
    setNitQuery(account.tax_id ?? '');
    setAccountHits([]);
    setAccountListOpen(false);
    setContactSlots(emptyContactSlots());
    resetContactDraft();
  }

  function selectPerson(index: number, person: Person) {
    setContactSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index
          ? { ...slot, person_id: person.person_id, label: personLabel(person) }
          : slot,
      ),
    );
    setPersonQuery('');
    setActivePersonSearch(null);
  }

  function clearPerson(index: number) {
    setContactSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, person_id: null, label: '' } : slot,
      ),
    );
    if (activePersonSearch === index) {
      resetContactDraft();
    }
  }

  function toggleSlotTipo(index: number, tipo: LeadInfluenciaKey) {
    setContactSlots((current) =>
      current.map((slot, slotIndex) => {
        if (slotIndex !== index) {
          return slot;
        }
        const selected = slot.tipos_influencia[0] === tipo;
        return {
          ...slot,
          tipos_influencia: selected ? [] : [tipo],
        };
      }),
    );
  }

  function addContactRow() {
    setContactSlots((current) => [...current, emptyContact()]);
  }

  function removeContactRow(index: number) {
    if (index === 0) {
      return;
    }
    setContactSlots((current) =>
      current.filter((_, slotIndex) => slotIndex !== index),
    );
    if (activePersonSearch === index) {
      resetContactDraft();
      return;
    }
    if (activePersonSearch !== null && activePersonSearch > index) {
      setActivePersonSearch(activePersonSearch - 1);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.city.trim() || !form.region.trim()) {
      setError('Selecciona la ciudad (la región se completa automáticamente).');
      return;
    }

    if (!selectedAccount) {
      setError('Selecciona una empresa existente (créala desde Empresas si no está).');
      return;
    }

    const contacts = contactSlots.flatMap((slot) => {
      if (!slot.person_id) {
        return [];
      }
      return [
        {
          person_id: slot.person_id,
          ...(slot.tipos_influencia[0]
            ? { tipo_influencia: slot.tipos_influencia[0] }
            : {}),
        },
      ];
    });
    if (contacts.length === 0) {
      setError(
        'Asocia al menos un contacto. El tipo (Económica, Técnica, Fábrica, Usuario o Coach) es opcional.',
      );
      return;
    }

    if (requiresChecklist) {
      const allChecked = CHECKLIST_CRITERIA.every(({ key }) => checklist[key]);
      if (!allChecked) {
        setError('Marca los tres criterios del checklist para crear el lead.');
        return;
      }
    }

    if (showTraductorSelect && !form.business_referrer_id) {
      setError('Selecciona el traductor de negocio referente.');
      return;
    }

    if (!form.segment_id) {
      setError('Selecciona un segmento.');
      return;
    }

    const catalogSegment = segments.find(
      (segment) => segment.id === form.segment_id,
    );
    const segmentoEnum = catalogSegment
      ? SEGMENT_NAME_TO_ENUM[catalogSegment.name]
      : undefined;
    if (!segmentoEnum) {
      setError('El segmento seleccionado no es válido.');
      return;
    }

    if (segmentoEnum === 'Industria' && !form.subsegment_id) {
      setError('Selecciona un subsegmento.');
      return;
    }

    setIsSubmitting(true);

    const payload: CreateLeadPayload = {
      tipo_lead: 'Inbound',
      origen: form.origen,
      canal_origen: form.canal_origen,
      segmento: segmentoEnum,
      city: form.city.trim(),
      region: form.region,
      pais: 'CO',
      contacts,
      responsable_id: responsableId,
      segment_id: form.segment_id,
      ...(form.subsegment_id ? { subsegment_id: form.subsegment_id } : {}),
      referrer_name: showReferidoName
        ? form.referrer_name.trim() || null
        : null,
      ...(selectedAccount.tax_id ? { nit: selectedAccount.tax_id } : {}),
      account_id: selectedAccount.account_id,
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
        <section className="space-y-3">
          <p className="text-xs text-muted">
            La empresa debe existir en el catálogo.{' '}
            <Link
              to="/accounts/empresas"
              className="font-bold text-accent hover:underline"
              onClick={onClose}
            >
              Crear o editar en Empresas
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="lead-data-title">
          <h3 id="lead-data-title" className="text-sm font-bold text-ink">
            Datos del lead
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2" ref={accountSearchRef}>
              <div className="relative">
                <label className={labelClass} htmlFor="lead-empresa">
                  Empresa
                </label>
                <input
                  id="lead-empresa"
                  value={empresaQuery}
                  onChange={(event) => {
                    setEmpresaQuery(event.target.value);
                    clearSelectedAccount();
                    setAccountListOpen(true);
                  }}
                  onFocus={() => {
                    if (!selectedAccount && accountHits.length > 0) {
                      setAccountListOpen(true);
                    }
                  }}
                  className={inputClass}
                  placeholder="Escribe el nombre de la empresa"
                  autoComplete="off"
                  required={!selectedAccount}
                />
                {!selectedAccount &&
                accountListOpen &&
                (accountHits.length > 0 || accountSearching) ? (
                  <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded border border-border bg-surface shadow-card">
                    {accountSearching ? (
                      <li className="px-3 py-2 text-sm text-muted">Buscando…</li>
                    ) : (
                      accountHits.map((account) => (
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
                      ))
                    )}
                  </ul>
                ) : null}
                {!selectedAccount &&
                !accountSearching &&
                (empresaQuery.trim().length >= 2 || nitQuery.trim().length >= 2) &&
                accountHits.length === 0 ? (
                  <p className="mt-1 text-xs text-muted">
                    Sin coincidencias. Crea la empresa en{' '}
                    <Link
                      to="/accounts/empresas"
                      className="font-bold text-accent hover:underline"
                      onClick={onClose}
                    >
                      Empresas
                    </Link>
                    .
                  </p>
                ) : null}
              </div>

              <div>
                <label className={labelClass} htmlFor="lead-nit">
                  NIT
                </label>
                <input
                  id="lead-nit"
                  value={nitQuery}
                  onChange={(event) => {
                    setNitQuery(event.target.value);
                    clearSelectedAccount();
                    setAccountListOpen(true);
                  }}
                  onFocus={() => {
                    if (!selectedAccount && accountHits.length > 0) {
                      setAccountListOpen(true);
                    }
                  }}
                  className={inputClass}
                  placeholder="Buscar por NIT"
                  autoComplete="off"
                  readOnly={!!selectedAccount && !!selectedAccount.tax_id}
                />
              </div>
            </div>

            <Field label="Canal de origen">
              <select
                value={form.canal_origen}
                onChange={(event) => {
                  const canal = event.target.value as CanalOrigen;
                  setForm((prev) => ({
                    ...prev,
                    canal_origen: canal,
                    business_referrer_id:
                      canal === 'TRADUCTOR_NEGOCIO'
                        ? prev.business_referrer_id
                        : '',
                    referrer_name:
                      canal === 'REFERIDO' ? prev.referrer_name : '',
                  }));
                }}
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

            {showReferidoName ? (
              <Field label="Nombre de quien refiere">
                <input
                  id="lead-referrer-name"
                  value={form.referrer_name}
                  onChange={(event) =>
                    update('referrer_name', event.target.value)
                  }
                  className={inputClass}
                  maxLength={100}
                  placeholder="Opcional, hasta 100 caracteres"
                />
              </Field>
            ) : null}

            <Field label="Segmento">
              <select
                value={form.segment_id}
                onChange={(event) => syncSegmentoFromId(event.target.value)}
                className={inputClass}
                required
              >
                <option value="">Seleccionar segmento</option>
                {segments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Subsegmento">
              <select
                value={form.subsegment_id}
                onChange={(event) =>
                  update('subsegment_id', event.target.value)
                }
                className={inputClass}
                disabled={!selectedSegment}
                required={requiresSubsegment}
              >
                {!selectedSegment ? (
                  <option value="">Selecciona un segmento primero</option>
                ) : selectedSegment.subsegments.length === 0 ? (
                  <option value="">Sin subsegmentos</option>
                ) : (
                  <>
                    <option value="">
                      {requiresSubsegment
                        ? 'Seleccionar subsegmento'
                        : 'Sin subsegmento'}
                    </option>
                    {selectedSegment.subsegments.map((subsegment) => (
                      <option key={subsegment.id} value={subsegment.id}>
                        {subsegment.name}
                      </option>
                    ))}
                  </>
                )}
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

            <Field label="Ciudad">
              <ColombiaCitySearchField
                id="lead-city"
                value={form.city}
                departamento={form.region}
                onSelect={(row) => {
                  setForm((prev) => ({
                    ...prev,
                    city: row.municipio,
                    region: row.departamento,
                  }));
                }}
                onClear={() => {
                  setForm((prev) => ({
                    ...prev,
                    city: '',
                    region: '',
                  }));
                }}
              />
            </Field>

            <Field label="Región">
              <input
                value={form.region}
                className={inputClass}
                readOnly
                required
                placeholder="Se completa al elegir la ciudad"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="lead-contacts-title">
          <div>
            <h3 id="lead-contacts-title" className="text-sm font-bold text-ink">
              Contactos
            </h3>
            <p className="text-xs text-muted">
              Asocia al menos un contacto. El tipo (Económica, Técnica, Fábrica,
              Usuario o Coach) se puede marcar en la fila o dejar sin definir.
            </p>
          </div>

          {!selectedAccount ? (
            <p className="text-sm text-muted">
              Selecciona una empresa para asignar contactos.
            </p>
          ) : (
            <div className="overflow-hidden rounded border border-border bg-bg">
              <div className={`${influenceTableRowClass} border-b border-border`}>
                <span className={contactTableHeaderClass}>#</span>
                <span className={contactTableHeaderClass}>Persona</span>
                <span className={`${contactTableHeaderClass} text-right`}>
                  Tipo (opcional)
                </span>
                <span />
              </div>

              {contactSlots.map((slot, index) => {
                const searching = activePersonSearch === index;
                const label = rowLabel(index);

                return (
                  <div
                    key={slot.slotId}
                    className={`${influenceTableRowClass} border-b border-border`}
                  >
                    <p
                      className={`truncate text-sm ${
                        index === 0 ? 'font-bold text-ink' : 'text-muted'
                      }`}
                    >
                      {label}
                    </p>

                    <div className="relative min-w-0">
                      {slot.person_id ? (
                        <button
                          type="button"
                          className="truncate text-left text-sm font-bold text-ink hover:text-accent"
                          onClick={() => {
                            clearPerson(index);
                            setActivePersonSearch(index);
                            setPersonQuery('');
                          }}
                        >
                          {slot.label}
                        </button>
                      ) : searching ? (
                        <>
                          <input
                            value={personQuery}
                            onChange={(event) => {
                              setActivePersonSearch(index);
                              setPersonQuery(event.target.value);
                            }}
                            className={inputClass}
                            placeholder={
                              peopleLoading
                                ? 'Cargando contactos…'
                                : 'Buscar contacto...'
                            }
                            disabled={peopleLoading}
                            autoComplete="off"
                            autoFocus
                            aria-label={`Buscar persona para ${label}`}
                          />
                          <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded border border-border bg-surface shadow-card">
                            {filteredPeople.length === 0 ? (
                              <li className="px-3 py-2 text-xs text-muted">
                                {accountPeople.length === 0
                                  ? 'Esta empresa no tiene contactos.'
                                  : 'Sin coincidencias.'}
                              </li>
                            ) : (
                              filteredPeople.map((person) => (
                                <li key={person.person_id}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      selectPerson(index, person)
                                    }
                                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-bg"
                                  >
                                    <span className="font-bold text-ink">
                                      {person.name}
                                    </span>
                                    <span className="text-xs text-muted">
                                      {[person.job_title, person.email]
                                        .filter(Boolean)
                                        .join(' · ') ||
                                        'Sin datos adicionales'}
                                    </span>
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="truncate text-left text-sm text-muted hover:text-ink"
                          onClick={() => {
                            setActivePersonSearch(index);
                            setPersonQuery('');
                          }}
                          disabled={peopleLoading}
                        >
                          {peopleLoading
                            ? 'Cargando contactos…'
                            : 'Buscar contacto...'}
                        </button>
                      )}
                    </div>

                    <div
                      className="flex flex-wrap content-center justify-end gap-1"
                      role="group"
                      aria-label={`Tipo de ${label}`}
                    >
                      {LEAD_INFLUENCIA_SLOTS.map(({ key, label: chipLabel }) => {
                        const pressed = slot.tipos_influencia[0] === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={pressed}
                            onClick={() => toggleSlotTipo(index, key)}
                            className={
                              pressed
                                ? influenceChipPressedClass
                                : influenceChipClass
                            }
                          >
                            {chipLabel}
                          </button>
                        );
                      })}
                    </div>

                    {index === 0 ? (
                      <span />
                    ) : (
                      <button
                        type="button"
                        className="icon-btn grid h-7 w-7 place-items-center rounded text-muted hover:text-danger"
                        aria-label={`Quitar ${label}`}
                        onClick={() => removeContactRow(index)}
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={addContactRow}
                  className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Agregar contacto
                </button>
                <Link
                  to={`/accounts/contactos?account_id=${encodeURIComponent(selectedAccount.account_id)}&new=1`}
                  className="text-xs font-bold text-accent hover:underline"
                  onClick={onClose}
                >
                  Crear contacto
                </Link>
              </div>
            </div>
          )}
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
