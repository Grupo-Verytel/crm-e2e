import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { fetchAccounts, fetchPeople } from '../../accounts/api/accounts-api';
import { resolvePersonInfluenciaTipo } from '../../accounts/lib/person-influencia-extensions';
import type { Account, Person } from '../../accounts/types';
import { createLead, checkLeadNameAvailable } from '../api/leads-api';
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
import { CANAL_ORIGEN_LABEL, LEAD_INFLUENCIA_SLOTS } from '../lib/lead-vocab';
import { ColombiaCitySearchField } from '../../discovery/components/ColombiaCitySearchField';
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

type InfluenciaKey = (typeof LEAD_INFLUENCIA_SLOTS)[number]['key'];

type FormState = {
  name: string;
  tipo_lead: TipoLead;
  origen: OrigenLead;
  canal_origen: CanalOrigen;
  segmento: Segmento;
  segment_id: string;
  subsegment_id: string;
  ciudad: string;
  region: string;
  business_referrer_id: string;
};

type ContactSlot = {
  person_id: string | null;
  label: string;
};

const emptyContact = (): ContactSlot => ({ person_id: null, label: '' });

const emptyInfluences = (): Record<InfluenciaKey, ContactSlot> => ({
  Economica: emptyContact(),
  Tecnica: emptyContact(),
  Fabrica: emptyContact(),
});

const emptyChecklist = (): CreateLeadChecklistInput => ({
  criterio_sector_objetivo: false,
  criterio_necesidad_portafolio: false,
  criterio_acceso_decisor: false,
  criterio_presupuesto_indicios: false,
});

const initialState: FormState = {
  name: '',
  tipo_lead: 'Inbound',
  origen: 'Web',
  canal_origen: 'CAMPANA_DIGITAL',
  segmento: 'Gobierno',
  segment_id: '',
  subsegment_id: '',
  ciudad: '',
  region: '',
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

function personLabel(person: Person): string {
  return `${person.name}${person.email ? ` · ${person.email}` : ''}`;
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
  const [empresaQuery, setEmpresaQuery] = useState('');
  const [nitQuery, setNitQuery] = useState('');
  const [accountHits, setAccountHits] = useState<Account[]>([]);
  const [accountSearching, setAccountSearching] = useState(false);
  const [accountListOpen, setAccountListOpen] = useState(false);
  const accountSearchRef = useRef<HTMLDivElement>(null);

  const [influences, setInfluences] =
    useState<Record<InfluenciaKey, ContactSlot>>(emptyInfluences);
  const [accountPeople, setAccountPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [activePersonSearch, setActivePersonSearch] = useState<InfluenciaKey | null>(
    null,
  );
  const [personQuery, setPersonQuery] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameAvailable, setNameAvailable] = useState<
    boolean | null | 'checking'
  >(null);

  const canalOptions = canalOptionsForMode(mode);
  const selectedSegment = segments.find((segment) => segment.id === form.segment_id);
  const requiresChecklist = mode === 'product_manager' || mode === 'ejecutivo';
  const showTraductorSelect =
    mode === 'ejecutivo' && form.canal_origen === 'TRADUCTOR_NEGOCIO';

  const filteredPeople = useMemo(() => {
    const typed = activePersonSearch
      ? accountPeople.filter(
          (person) =>
            resolvePersonInfluenciaTipo(person) === activePersonSearch,
        )
      : accountPeople;
    const q = personQuery.trim().toLowerCase();
    if (!q) {
      return typed;
    }
    return typed.filter((person) => {
      const haystack = [person.name, person.email, person.job_title, person.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [accountPeople, personQuery, activePersonSearch]);

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
    const trimmed = form.name.trim();
    if (trimmed.length < 1) {
      setNameAvailable(null);
      return;
    }

    let active = true;
    setNameAvailable('checking');
    const timer = window.setTimeout(() => {
      void checkLeadNameAvailable(trimmed)
        .then((result) => {
          if (active) {
            setNameAvailable(result.available);
          }
        })
        .catch(() => {
          if (active) {
            setNameAvailable(null);
          }
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.name]);

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

  function selectAccount(account: Account) {
    setSelectedAccount(account);
    setEmpresaQuery(account.name);
    setNitQuery(account.tax_id ?? '');
    setAccountHits([]);
    setAccountListOpen(false);
    setInfluences(emptyInfluences());
    setActivePersonSearch(null);
    setPersonQuery('');
  }

  function selectPerson(tipo: InfluenciaKey, person: Person) {
    setInfluences((current) => ({
      ...current,
      [tipo]: {
        person_id: person.person_id,
        label: personLabel(person),
      },
    }));
    setActivePersonSearch(null);
    setPersonQuery('');
  }

  function clearPerson(tipo: InfluenciaKey) {
    setInfluences((current) => ({
      ...current,
      [tipo]: emptyContact(),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Indica el nombre del lead.');
      return;
    }

    if (nameAvailable === false) {
      setError('Ya existe un lead con ese nombre.');
      return;
    }

    if (!selectedAccount) {
      setError('Selecciona una empresa existente (créala desde Empresas si no está).');
      return;
    }

    const contacts = LEAD_INFLUENCIA_SLOTS.flatMap(({ key }) => {
      const slot = influences[key];
      if (!slot.person_id) {
        return [];
      }
      return [{ person_id: slot.person_id, tipo_influencia: key }];
    });
    if (contacts.length === 0) {
      setError('Asigna al menos un contacto en Económica, Técnica o Fábrica.');
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

    if (!form.ciudad.trim() || !form.region.trim()) {
      setError('Selecciona la ciudad (la región se completa automáticamente).');
      return;
    }

    const industria = selectedAccount.economic_sector?.trim() ?? '';
    if (form.segmento === 'B2B' && !industria) {
      setError(
        'La empresa no tiene sector económico. Complétalo en Empresas antes de crear el lead B2B.',
      );
      return;
    }

    setIsSubmitting(true);

    const payload: CreateLeadPayload = {
      name: form.name.trim(),
      tipo_lead: form.tipo_lead,
      origen: form.origen,
      canal_origen: form.canal_origen,
      segmento: form.segmento,
      ciudad: form.ciudad.trim(),
      region: form.region.trim(),
      pais: 'CO',
      contacts,
      responsable_id: responsableId,
      ...(form.segment_id ? { segment_id: form.segment_id } : {}),
      ...(form.subsegment_id ? { subsegment_id: form.subsegment_id } : {}),
      ...(form.segmento === 'B2B' ? { industria } : {}),
      ...(selectedAccount.tax_id || nitQuery.trim()
        ? { nit: selectedAccount.tax_id ?? nitQuery.trim() }
        : {}),
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
          <div>
            <label className={labelClass} htmlFor="lead-name">
              Nombre del lead
            </label>
            <input
              id="lead-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              className={inputClass}
              placeholder="Nombre único del lead"
              required
              autoComplete="off"
            />
            {nameAvailable === false ? (
              <p className="mt-1 text-xs text-danger">
                Ya existe un lead con ese nombre.
              </p>
            ) : null}
            {nameAvailable === true && form.name.trim() ? (
              <p className="mt-1 text-xs text-muted">Nombre disponible.</p>
            ) : null}
          </div>

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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative sm:col-span-1" ref={accountSearchRef}>
              <label className={labelClass} htmlFor="lead-empresa">
                Empresa
              </label>
              <input
                id="lead-empresa"
                value={empresaQuery}
                onChange={(event) => {
                  setEmpresaQuery(event.target.value);
                  if (selectedAccount) {
                    setSelectedAccount(null);
                    setInfluences(emptyInfluences());
                  }
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
              {!selectedAccount && accountListOpen && (accountHits.length > 0 || accountSearching) ? (
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
                  if (selectedAccount) {
                    setSelectedAccount(null);
                    setInfluences(emptyInfluences());
                  }
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
              <Field label="Industria">
                <input
                  value={selectedAccount?.economic_sector ?? ''}
                  className={inputClass}
                  readOnly
                  required
                  placeholder={
                    selectedAccount
                      ? 'La empresa no tiene sector económico'
                      : 'Se completa al seleccionar la empresa'
                  }
                />
              </Field>
            ) : null}

            <Field label="Ciudad">
              <ColombiaCitySearchField
                id="lead-ciudad"
                value={form.ciudad}
                departamento={form.region}
                onSelect={(row) => {
                  setForm((prev) => ({
                    ...prev,
                    ciudad: row.municipio,
                    region: row.departamento,
                  }));
                }}
                onClear={() => {
                  setForm((prev) => ({
                    ...prev,
                    ciudad: '',
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

        <section className="space-y-3" aria-labelledby="lead-influencias-title">
          <div>
            <h3 id="lead-influencias-title" className="text-sm font-bold text-ink">
              Contactos por influencia
            </h3>
            <p className="text-xs text-muted">
              Coselecciona contactos de la empresa en Económica, Técnica y/o
              Fábrica. Al menos uno es obligatorio.
            </p>
          </div>

          {!selectedAccount ? (
            <p className="text-sm text-muted">
              Selecciona una empresa para asignar contactos.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {LEAD_INFLUENCIA_SLOTS.map(({ key, label }) => {
                const slot = influences[key];
                const searching = activePersonSearch === key;

                return (
                  <div
                    key={key}
                    className="rounded border border-border bg-bg p-3"
                  >
                    <p className="mb-3 text-sm font-bold text-ink">{label}</p>
                    <span className={labelClass}>Contacto</span>

                    {slot.person_id ? (
                      <div className="relative rounded border border-border bg-surface p-2.5 pr-8 text-xs">
                        <button
                          type="button"
                          className="icon-btn absolute right-1 top-1 grid h-6 w-6 place-items-center rounded text-muted"
                          aria-label={`Quitar contacto de ${label}`}
                          onClick={() => clearPerson(key)}
                        >
                          <X size={14} strokeWidth={2.5} />
                        </button>
                        <p className="font-bold text-ink">{slot.label}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          value={searching ? personQuery : ''}
                          onChange={(event) => {
                            setActivePersonSearch(key);
                            setPersonQuery(event.target.value);
                          }}
                          onFocus={() => {
                            setActivePersonSearch(key);
                            setPersonQuery('');
                          }}
                          className={inputClass}
                          placeholder={
                            peopleLoading
                              ? 'Cargando contactos…'
                              : 'Buscar contacto'
                          }
                          disabled={peopleLoading}
                          autoComplete="off"
                        />
                        {searching ? (
                          <ul className="max-h-40 overflow-y-auto rounded border border-border bg-surface">
                            {filteredPeople.length === 0 ? (
                              <li className="px-3 py-2 text-xs text-muted">
                                {accountPeople.length === 0
                                  ? 'Esta empresa no tiene contactos. Créalos en Contactos.'
                                  : 'No hay contactos con esta tipología. Defínela en Contactos.'}
                              </li>
                            ) : (
                              filteredPeople.map((person) => (
                                <li key={person.person_id}>
                                  <button
                                    type="button"
                                    onClick={() => selectPerson(key, person)}
                                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-bg"
                                  >
                                    <span className="font-bold text-ink">
                                      {person.name}
                                    </span>
                                    <span className="text-xs text-muted">
                                      {[person.job_title, person.email]
                                        .filter(Boolean)
                                        .join(' · ') || 'Sin datos adicionales'}
                                    </span>
                                  </button>
                                </li>
                              ))
                            )}
                          </ul>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
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
            disabled={
              isSubmitting ||
              nameAvailable === false ||
              nameAvailable === 'checking'
            }
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
