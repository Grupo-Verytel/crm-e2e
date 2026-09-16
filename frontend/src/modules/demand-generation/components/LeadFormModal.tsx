import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { fetchAccounts, fetchPeople } from '../../accounts/api/accounts-api';
import { AccountFormModal } from '../../accounts/components/AccountFormModal';
import type { Account, Person } from '../../accounts/types';
import { createLead } from '../api/leads-api';
import { fetchSegments } from '../api/segments-api';
import { fetchTraductorReferrers } from '../api/traductores-api';
import type { User } from '../../auth/types';
import {
  CANALES_ORIGEN,
  ORIGENES_LEAD,
  SEGMENTOS,
  type CanalOrigen,
  type CreateLeadChecklistInput,
  type CreateLeadPayload,
  type Lead,
  type LeadFormMode,
  type OrigenLead,
  type Segment,
  type Segmento,
} from '../types';
import { CANAL_ORIGEN_LABEL } from '../lib/lead-vocab';
import {
  isIndustriaSegmento,
  segmentoLabel,
  TIPOS_INDUSTRIA,
  type TipoIndustria,
} from '../lib/segment-catalog';
import { ColombiaCitySearchField } from '../../discovery/components/ColombiaCitySearchField';
import { ModalShell } from './ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

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

const CONTACT_SLOTS = [
  { key: 'contact1', label: 'Contacto 1' },
  { key: 'contact2', label: 'Contacto 2' },
  { key: 'contact3', label: 'Contacto 3' },
] as const;

const INFLUENCE_TYPES = [
  'Economica',
  'Tecnica',
  'Fabrica',
  'Coach',
  'Usuario',
] as const;

type ContactSlotKey = (typeof CONTACT_SLOTS)[number]['key'];
type InfluenceType = (typeof INFLUENCE_TYPES)[number];

type FormState = {
  origen: OrigenLead;
  canal_origen: CanalOrigen;
  referido_nombre: string;
  segmento: Segmento | '';
  segment_id: string;
  subsegment_id: string;
  tipo_industria: TipoIndustria | '';
  ciudad: string;
  region: string;
  business_referrer_id: string;
};

type ContactSlot = {
  person_id: string | null;
  person: Person | null;
  tipo_influencia: InfluenceType | '';
};

const emptyContact = (): ContactSlot => ({
  person_id: null,
  person: null,
  tipo_influencia: '',
});

const emptyInfluences = (): Record<ContactSlotKey, ContactSlot> => ({
  contact1: emptyContact(),
  contact2: emptyContact(),
  contact3: emptyContact(),
});

const emptyChecklist = (): CreateLeadChecklistInput => ({
  criterio_sector_objetivo: false,
  criterio_necesidad_portafolio: false,
  criterio_acceso_decisor: false,
});

const initialState: FormState = {
  origen: 'Web',
  canal_origen: 'CAMPANA_DIGITAL',
  referido_nombre: '',
  segmento: '',
  segment_id: '',
  subsegment_id: '',
  tipo_industria: '',
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
    useState<Record<ContactSlotKey, ContactSlot>>(emptyInfluences);
  const [accountPeople, setAccountPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [activePersonSearch, setActivePersonSearch] = useState<ContactSlotKey | null>(
    null,
  );
  const [personQuery, setPersonQuery] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  const canalOptions = canalOptionsForMode(mode);
  const selectedSegment = segments.find(
    (segment) =>
      segment.id === form.segment_id || segment.name === form.segmento,
  );
  const showTipoIndustria = isIndustriaSegmento(form.segmento);
  const requiresChecklist = mode === 'product_manager' || mode === 'ejecutivo';
  const showTraductorSelect =
    mode === 'ejecutivo' && form.canal_origen === 'TRADUCTOR_NEGOCIO';
  const showReferidoName = form.canal_origen === 'REFERIDO';

  const filteredPeople = useMemo(() => {
    const selectedInOtherSlots = new Set(
      CONTACT_SLOTS.flatMap(({ key }) =>
        key !== activePersonSearch && influences[key].person_id
          ? [influences[key].person_id]
          : [],
      ),
    );
    const available = accountPeople.filter(
      (person) => !selectedInOtherSlots.has(person.person_id),
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
  }, [accountPeople, personQuery, activePersonSearch, influences]);

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

  function selectSegmento(segmento: Segmento | '') {
    const segment = segments.find(
      (item) => item.name === segmento || segmentoLabel(item.name) === segmento,
    );
    setForm((prev) => ({
      ...prev,
      segmento,
      segment_id: segment?.id ?? '',
      subsegment_id: '',
      tipo_industria: isIndustriaSegmento(segmento) ? prev.tipo_industria : '',
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

  function selectPerson(slotKey: ContactSlotKey, person: Person) {
    setInfluences((current) => ({
      ...current,
      [slotKey]: {
        ...current[slotKey],
        person_id: person.person_id,
        person,
      },
    }));
    setActivePersonSearch(null);
    setPersonQuery('');
  }

  function clearPerson(slotKey: ContactSlotKey) {
    setInfluences((current) => ({
      ...current,
      [slotKey]: {
        ...emptyContact(),
        tipo_influencia: current[slotKey].tipo_influencia,
      },
    }));
  }

  function updateInfluenceType(
    slotKey: ContactSlotKey,
    tipoInfluencia: InfluenceType | '',
  ) {
    setInfluences((current) => ({
      ...current,
      [slotKey]: {
        ...current[slotKey],
        tipo_influencia: tipoInfluencia,
      },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedAccount) {
      setError('Selecciona una empresa existente (créala desde Empresas si no está).');
      return;
    }

    if (!form.segmento) {
      setError('Selecciona el segmento.');
      return;
    }

    if (showTipoIndustria && !form.tipo_industria) {
      setError('Selecciona el tipo de industria.');
      return;
    }

    const contacts = CONTACT_SLOTS.flatMap(({ key }) => {
      const slot = influences[key];
      if (!slot.person_id) {
        return [];
      }
      return [
        {
          person_id: slot.person_id,
          ...(slot.tipo_influencia
            ? { tipo_influencia: slot.tipo_influencia }
            : {}),
        },
      ];
    });
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

    if (showReferidoName && !form.referido_nombre.trim()) {
      setError('Indica el nombre del referido.');
      return;
    }

    if (!form.ciudad.trim() || !form.region.trim()) {
      setError('Selecciona la ciudad (la región se completa automáticamente).');
      return;
    }

    const matchedSegment =
      selectedSegment ??
      segments.find(
        (segment) =>
          segment.name === form.segmento ||
          segmentoLabel(segment.name) === form.segmento,
      );

    setIsSubmitting(true);

    const payload: CreateLeadPayload = {
      name: selectedAccount.name.trim(),
      tipo_lead: 'Inbound',
      origen: form.origen,
      canal_origen: form.canal_origen,
      segmento: form.segmento,
      ciudad: form.ciudad.trim(),
      region: form.region.trim(),
      pais: 'CO',
      contacts,
      responsable_id: responsableId,
      ...(matchedSegment ? { segment_id: matchedSegment.id } : {}),
      ...(form.subsegment_id ? { subsegment_id: form.subsegment_id } : {}),
      ...(showTipoIndustria && form.tipo_industria
        ? { industria: form.tipo_industria }
        : {}),
      ...(selectedAccount.tax_id || nitQuery.trim()
        ? { nit: selectedAccount.tax_id ?? nitQuery.trim() }
        : {}),
      ...(showTraductorSelect && form.business_referrer_id
        ? { business_referrer_id: form.business_referrer_id }
        : {}),
      ...(showReferidoName
        ? { sub_origen: form.referido_nombre.trim() }
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
      <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="space-y-3">
          <p className="text-xs text-muted">
            La empresa debe existir en el catálogo.{' '}
            <button
              type="button"
              className="font-bold text-accent hover:underline"
              onClick={() => setShowCreateAccount(true)}
            >
              Crear empresa
            </button>
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
                  Sin coincidencias.{' '}
                  <button
                    type="button"
                    className="font-bold text-accent hover:underline"
                    onClick={() => setShowCreateAccount(true)}
                  >
                    Crear empresa
                  </button>
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
                onChange={(event) => {
                  const canal = event.target.value as CanalOrigen;
                  setForm((prev) => ({
                    ...prev,
                    canal_origen: canal,
                    referido_nombre:
                      canal === 'REFERIDO' ? prev.referido_nombre : '',
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

            {showReferidoName ? (
              <Field label="Nombre del referido">
                <input
                  value={form.referido_nombre}
                  onChange={(event) =>
                    update('referido_nombre', event.target.value)
                  }
                  className={inputClass}
                  maxLength={80}
                  placeholder="Nombre de quien realizó la referencia"
                  required
                />
              </Field>
            ) : null}

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

            <Field label="Segmento">
              <select
                value={form.segmento}
                onChange={(event) =>
                  selectSegmento(event.target.value as Segmento | '')
                }
                className={inputClass}
                required
              >
                <option value="">Seleccionar</option>
                {SEGMENTOS.map((segmento) => (
                  <option key={segmento} value={segmento}>
                    {segmento}
                  </option>
                ))}
              </select>
            </Field>

            {showTipoIndustria ? (
              <Field label="Tipo de industria">
                <select
                  value={form.tipo_industria}
                  onChange={(event) =>
                    update(
                      'tipo_industria',
                      event.target.value as TipoIndustria | '',
                    )
                  }
                  className={inputClass}
                  required
                >
                  <option value="">Seleccionar</option>
                  {TIPOS_INDUSTRIA.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

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
              Contactos
            </h3>
            <p className="text-xs text-muted">
              Puedes seleccionar hasta tres contactos. Esta sección y el tipo de
              influencia son opcionales.
            </p>
          </div>

          {!selectedAccount ? (
            <p className="text-sm text-muted">
              Selecciona una empresa para asignar contactos.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {CONTACT_SLOTS.map(({ key, label }) => {
                const slot = influences[key];
                const searching = activePersonSearch === key;

                return (
                  <div
                    key={key}
                    className="min-w-0 rounded border border-border bg-bg p-2"
                  >
                    <p className="mb-2 text-sm font-bold text-ink">{label}</p>
                    <span className={labelClass}>Contacto</span>

                    {slot.person_id && slot.person ? (
                      <div className="relative rounded border border-border bg-surface p-2 pr-8 text-xs">
                        <button
                          type="button"
                          className="icon-btn absolute right-1 top-1 grid h-6 w-6 place-items-center rounded text-muted"
                          aria-label={`Quitar contacto de ${label}`}
                          onClick={() => clearPerson(key)}
                        >
                          <X size={14} strokeWidth={2.5} />
                        </button>
                        <p className="mb-1.5 truncate text-sm font-bold text-ink">
                          {slot.person.name}
                        </p>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                          <dt className="font-bold text-muted">Cargo</dt>
                          <dd className="min-w-0 text-ink">
                            {slot.person.job_title ?? '—'}
                          </dd>
                          <dt className="font-bold text-muted">Email</dt>
                          <dd className="min-w-0 break-all text-ink">
                            {slot.person.email ?? '—'}
                          </dd>
                          <dt className="font-bold text-muted">Teléfono</dt>
                          <dd className="min-w-0 text-ink">
                            {slot.person.phone ?? '—'}
                          </dd>
                          <dt className="font-bold text-muted">Empresa</dt>
                          <dd className="min-w-0 break-words text-ink">
                            {slot.person.account_name ??
                              selectedAccount.name}
                          </dd>
                        </dl>
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
                                  : 'No hay más contactos disponibles.'}
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
                                      {[
                                        person.job_title,
                                        person.email,
                                        person.phone,
                                      ]
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

                    <label
                      className={`${labelClass} mt-2`}
                      htmlFor={`lead-influence-${key}`}
                    >
                      Tipo de influencia (opcional)
                    </label>
                    <select
                      id={`lead-influence-${key}`}
                      value={slot.tipo_influencia}
                      onChange={(event) =>
                        updateInfluenceType(
                          key,
                          event.target.value as InfluenceType | '',
                        )
                      }
                      className={inputClass}
                    >
                      <option value="">Sin definir</option>
                      {INFLUENCE_TYPES.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                    </select>
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
            disabled={isSubmitting}
            className={primaryButtonClass}
          >
            Crear lead
          </button>
        </div>
      </form>
      {showCreateAccount ? (
        <AccountFormModal
          editing="new"
          onClose={() => setShowCreateAccount(false)}
          onSaved={(account) => {
            selectAccount(account);
            setShowCreateAccount(false);
          }}
        />
      ) : null}
      </>
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
