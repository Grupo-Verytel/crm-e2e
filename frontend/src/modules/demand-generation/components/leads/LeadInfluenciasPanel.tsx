import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { fetchPeople } from '../../../accounts/api/accounts-api';
import type { Person } from '../../../accounts/types';
import { assignLeadInfluencia } from '../../api/leads-api';
import {
  contactInfluenciaTipo,
  contactJobTitle,
  contactPersonName,
} from '../../lib/contact-display';
import {
  LEAD_INFLUENCIA_SLOTS,
  type LeadInfluenciaKey,
} from '../../lib/lead-vocab';
import type { Lead } from '../../types';
import {
  contactTableHeaderClass,
  influenceChipClass,
  influenceChipPressedClass,
  influenceTableRowClass,
  inputClass,
} from '../ui';

type EligiblePerson = {
  person_id: string;
  name: string;
  job_title: string | null;
};

type DraftRow = {
  id: string;
  person: EligiblePerson | null;
};

type Props = {
  lead: Lead;
  canEdit: boolean;
  onLeadChange: (lead: Lead) => void;
  onError: (message: string | null) => void;
};

function rowLabel(index: number): string {
  return index === 0 ? 'Principal' : `Contacto ${index + 1}`;
}

export function LeadInfluenciasPanel({
  lead,
  canEdit,
  onLeadChange,
  onError,
}: Props) {
  const [accountPeople, setAccountPeople] = useState<Person[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [personQuery, setPersonQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const saveSeq = useRef(0);

  const contacts = useMemo(
    () =>
      [...(lead.contacts ?? [])].sort((a, b) => a.position - b.position),
    [lead.contacts],
  );
  const accountId = lead.account_id ?? contacts[0]?.account_id ?? null;

  useEffect(() => {
    if (!accountId) {
      setAccountPeople([]);
      return;
    }

    let active = true;
    void fetchPeople({ account_id: accountId, page: 1, limit: 100 })
      .then((data) => {
        if (active) setAccountPeople(data.items);
      })
      .catch(() => {
        if (active) setAccountPeople([]);
      });

    return () => {
      active = false;
    };
  }, [accountId, contacts.length]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!listRef.current?.contains(event.target as Node)) {
        setActiveSearch(null);
        setPersonQuery('');
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const takenPersonIds = useMemo(() => {
    const ids = new Set(contacts.map((contact) => contact.person_id));
    for (const draft of drafts) {
      if (draft.person) {
        ids.add(draft.person.person_id);
      }
    }
    return ids;
  }, [contacts, drafts]);

  const peopleOptions = useMemo(() => {
    const byId = new Map<string, EligiblePerson>();
    for (const person of accountPeople) {
      byId.set(person.person_id, {
        person_id: person.person_id,
        name: person.name,
        job_title: person.job_title,
      });
    }
    for (const contact of contacts) {
      if (!byId.has(contact.person_id)) {
        byId.set(contact.person_id, {
          person_id: contact.person_id,
          name: contactPersonName(contact),
          job_title: contactJobTitle(contact),
        });
      }
    }
    return [...byId.values()]
      .filter((person) => !takenPersonIds.has(person.person_id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accountPeople, contacts, takenPersonIds]);

  const filteredPeople = useMemo(() => {
    const q = personQuery.trim().toLowerCase();
    if (!q) {
      return peopleOptions;
    }
    return peopleOptions.filter((person) => {
      const haystack = [person.name, person.job_title]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [peopleOptions, personQuery]);

  async function persist(tipo: LeadInfluenciaKey, personId: string | null) {
    const seq = ++saveSeq.current;
    setSavingKey(personId ?? tipo);
    onError(null);
    try {
      const updated = await assignLeadInfluencia(
        lead.lead_id,
        tipo,
        personId,
      );
      if (saveSeq.current !== seq) return;
      onLeadChange(updated);
      if (personId) {
        setDrafts((current) =>
          current.filter((row) => row.person?.person_id !== personId),
        );
      }
      setActiveSearch(null);
      setPersonQuery('');
    } catch (err) {
      if (saveSeq.current !== seq) return;
      onError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el contacto de la influencia.',
      );
    } finally {
      if (saveSeq.current === seq) {
        setSavingKey(null);
      }
    }
  }

  function toggleTipo(personId: string, next: LeadInfluenciaKey) {
    const contact = contacts.find((item) => item.person_id === personId);
    const current = contact ? contactInfluenciaTipo(contact) : null;
    if (current === next) {
      void persist(next, null);
      return;
    }
    void persist(next, personId);
  }

  function addDraftRow() {
    setDrafts((current) => [
      ...current,
      { id: crypto.randomUUID(), person: null },
    ]);
  }

  function selectDraftPerson(draftId: string, person: EligiblePerson) {
    setDrafts((current) =>
      current.map((row) =>
        row.id === draftId ? { ...row, person } : row,
      ),
    );
    setActiveSearch(null);
    setPersonQuery('');
  }

  function removeDraft(draftId: string) {
    setDrafts((current) => current.filter((row) => row.id !== draftId));
    if (activeSearch === draftId) {
      setActiveSearch(null);
      setPersonQuery('');
    }
  }

  return (
    <section className="mt-5 border-t border-border pt-4">
      <h2 className="mb-1 text-sm font-bold text-ink">Influencias</h2>
      <p className="mb-3 text-xs text-muted">
        Los contactos del lead y su tipo (Económica, Técnica, Fábrica, Usuario
        o Coach) se muestran aquí. El tipo se guarda al instante. Un contacto
        solo puede ocupar un rol a la vez.
      </p>
      <div
        ref={listRef}
        className="overflow-hidden rounded border border-border bg-bg"
      >
        <div className={`${influenceTableRowClass} border-b border-border`}>
          <span className={contactTableHeaderClass}>#</span>
          <span className={contactTableHeaderClass}>Persona</span>
          <span className={`${contactTableHeaderClass} text-right`}>
            Tipo (opcional)
          </span>
          <span />
        </div>

        {contacts.length === 0 && drafts.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">
            Este lead no tiene contactos asociados.
          </p>
        ) : null}

        {contacts.map((contact, index) => {
          const tipo = contactInfluenciaTipo(contact);
          const busy = savingKey === contact.person_id;
          return (
            <div
              key={contact.contact_id}
              className={`${influenceTableRowClass} border-b border-border`}
            >
              <p
                className={`truncate text-sm ${
                  index === 0 ? 'font-bold text-ink' : 'text-muted'
                }`}
              >
                {rowLabel(index)}
              </p>
              <p className="truncate text-sm font-bold text-ink">
                {contactPersonName(contact)}
                {contactJobTitle(contact) ? (
                  <span className="font-normal text-muted">
                    {' '}
                    · {contactJobTitle(contact)}
                  </span>
                ) : null}
                {busy ? (
                  <span className="ml-2 font-bold text-accent">
                    Guardando…
                  </span>
                ) : null}
              </p>
              <TipoChips
                selected={tipo}
                disabled={!canEdit || busy}
                onToggle={(next) => toggleTipo(contact.person_id, next)}
                ariaLabel={`Tipo de ${contactPersonName(contact)}`}
              />
              <span />
            </div>
          );
        })}

        {drafts.map((draft, draftIndex) => {
          const searching = activeSearch === draft.id;
          const label = rowLabel(contacts.length + draftIndex);
          const busy = savingKey === draft.person?.person_id;
          return (
            <div
              key={draft.id}
              className={`${influenceTableRowClass} border-b border-border`}
            >
              <p className="truncate text-sm text-muted">{label}</p>
              <div className="relative min-w-0">
                {draft.person ? (
                  <p className="truncate text-sm font-bold text-ink">
                    {draft.person.name}
                    {draft.person.job_title ? (
                      <span className="font-normal text-muted">
                        {' '}
                        · {draft.person.job_title}
                      </span>
                    ) : null}
                  </p>
                ) : searching ? (
                  <>
                    <input
                      value={personQuery}
                      onChange={(event) => setPersonQuery(event.target.value)}
                      className={inputClass}
                      placeholder="Buscar contacto..."
                      autoComplete="off"
                      autoFocus
                      aria-label={`Buscar persona para ${label}`}
                    />
                    <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded border border-border bg-surface shadow-card">
                      {filteredPeople.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-muted">
                          {peopleOptions.length === 0
                            ? 'Esta empresa no tiene más contactos.'
                            : 'Sin coincidencias.'}
                        </li>
                      ) : (
                        filteredPeople.map((option) => (
                          <li key={option.person_id}>
                            <button
                              type="button"
                              onClick={() =>
                                selectDraftPerson(draft.id, option)
                              }
                              className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-bg"
                            >
                              <span className="font-bold text-ink">
                                {option.name}
                              </span>
                              {option.job_title ? (
                                <span className="text-xs text-muted">
                                  {option.job_title}
                                </span>
                              ) : null}
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
                      setActiveSearch(draft.id);
                      setPersonQuery('');
                    }}
                  >
                    Buscar contacto...
                  </button>
                )}
              </div>
              <TipoChips
                selected={null}
                disabled={!canEdit || !draft.person || busy}
                onToggle={(tipo) => {
                  if (draft.person) {
                    void persist(tipo, draft.person.person_id);
                  }
                }}
                ariaLabel={`Tipo de ${label}`}
              />
              <button
                type="button"
                className="icon-btn grid h-7 w-7 place-items-center rounded text-muted hover:text-danger"
                aria-label={`Quitar ${label}`}
                onClick={() => removeDraft(draft.id)}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}

        {canEdit ? (
          <div className="flex items-center gap-3 px-3 py-2.5">
            <button
              type="button"
              onClick={addDraftRow}
              className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
            >
              <Plus size={14} strokeWidth={2.5} />
              Agregar contacto
            </button>
            {accountId ? (
              <Link
                to={`/accounts/contactos?account_id=${encodeURIComponent(accountId)}&new=1`}
                className="text-xs font-bold text-accent hover:underline"
              >
                Crear contacto
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TipoChips({
  selected,
  disabled,
  onToggle,
  ariaLabel,
}: {
  selected: LeadInfluenciaKey | null;
  disabled: boolean;
  onToggle: (tipo: LeadInfluenciaKey) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="flex flex-wrap content-center justify-end gap-1"
      role="group"
      aria-label={ariaLabel}
    >
      {LEAD_INFLUENCIA_SLOTS.map(({ key, label }) => {
        const pressed = selected === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onToggle(key)}
            className={
              pressed ? influenceChipPressedClass : influenceChipClass
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
