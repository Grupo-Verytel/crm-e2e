import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { createPerson, fetchPeople } from '../../../accounts/api/accounts-api';
import type { Person } from '../../../accounts/types';
import {
  resolvePersonInfluenciaTipo,
  savePersonInfluenciaTipo,
} from '../../../accounts/lib/person-influencia-extensions';
import { assignLeadInfluencia } from '../../api/leads-api';
import {
  contactAccountName,
  contactEmail,
  contactJobTitle,
  contactPersonName,
  contactPhone,
} from '../../lib/contact-display';
import {
  LEAD_INFLUENCIA_SLOTS,
  type LeadInfluenciaKey,
} from '../../lib/lead-vocab';
import type { Lead } from '../../types';
import { ModalShell } from '../ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../ui';

type Props = {
  lead: Lead;
  canEdit: boolean;
  onLeadChange: (lead: Lead) => void;
  onError: (message: string | null) => void;
};

export function LeadInfluenciasPanel({
  lead,
  canEdit,
  onLeadChange,
  onError,
}: Props) {
  const [accountPeople, setAccountPeople] = useState<Person[]>([]);
  const [savingTipo, setSavingTipo] = useState<LeadInfluenciaKey | null>(null);
  const [addSlot, setAddSlot] = useState<LeadInfluenciaKey | null>(null);
  const saveSeq = useRef<Partial<Record<LeadInfluenciaKey, number>>>({});

  const accountId = lead.contacts[0]?.account_id ?? null;

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
  }, [accountId, lead.contacts.length]);

  const peopleOptions = useMemo(() => {
    const byId = new Map<
      string,
      {
        person_id: string;
        name: string;
        tipo_influencia: ReturnType<typeof resolvePersonInfluenciaTipo>;
      }
    >();
    for (const person of accountPeople) {
      byId.set(person.person_id, {
        person_id: person.person_id,
        name: person.name,
        tipo_influencia: resolvePersonInfluenciaTipo(person),
      });
    }
    for (const contact of lead.contacts) {
      if (!byId.has(contact.person_id)) {
        byId.set(contact.person_id, {
          person_id: contact.person_id,
          name: contactPersonName(contact),
          tipo_influencia: resolvePersonInfluenciaTipo({
            person_id: contact.person_id,
          }),
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [accountPeople, lead.contacts]);

  async function persist(
    tipo: LeadInfluenciaKey,
    personId: string | null,
  ) {
    const seq = (saveSeq.current[tipo] ?? 0) + 1;
    saveSeq.current[tipo] = seq;
    setSavingTipo(tipo);
    onError(null);
    try {
      const updated = await assignLeadInfluencia(
        lead.lead_id,
        tipo,
        personId,
      );
      if (saveSeq.current[tipo] !== seq) return;
      onLeadChange(updated);
    } catch (err) {
      if (saveSeq.current[tipo] !== seq) return;
      onError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el contacto de la influencia.',
      );
    } finally {
      if (saveSeq.current[tipo] === seq) {
        setSavingTipo(null);
      }
    }
  }

  return (
    <section className="mt-5 border-t border-border pt-4">
      <h2 className="mb-1 text-sm font-bold text-ink">Influencias</h2>
      <p className="mb-3 text-xs text-muted">
        El contacto se guarda al instante. En cada influencia solo aparecen
        contactos con esa tipología en Contactos.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {LEAD_INFLUENCIA_SLOTS.map(({ key, label }) => {
          const assigned = lead.contacts.find(
            (contact) => contact.tipo_influencia === key,
          );
          const isUnassigned = !assigned;
          const isSaving = savingTipo === key;

          return (
            <div
              key={key}
              className={[
                'rounded border p-3',
                isUnassigned
                  ? 'border-border bg-bg/80 opacity-75'
                  : 'border-border bg-bg',
              ].join(' ')}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p
                  className={`text-sm font-bold ${isUnassigned ? 'text-muted' : 'text-ink'}`}
                >
                  {label}
                </p>
                {isSaving ? (
                  <span className="text-xs font-bold text-accent">
                    Guardando…
                  </span>
                ) : null}
              </div>

              <label className={labelClass}>Contacto</label>
              {assigned ? (
                <div className="relative rounded border border-border bg-surface p-2.5 pr-8 text-xs">
                  {canEdit ? (
                    <button
                      type="button"
                      className="icon-btn absolute right-1 top-1 grid h-6 w-6 place-items-center rounded text-muted hover:text-danger"
                      aria-label={`Quitar contacto de ${label}`}
                      onClick={() => void persist(key, null)}
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  ) : null}
                  <p className="font-bold text-ink">
                    {contactPersonName(assigned)}
                  </p>
                  {contactJobTitle(assigned) ? (
                    <p className="mt-0.5 text-muted">
                      {contactJobTitle(assigned)}
                    </p>
                  ) : null}
                  {contactEmail(assigned) ? (
                    <p className="mt-0.5 text-ink">{contactEmail(assigned)}</p>
                  ) : null}
                  {contactPhone(assigned) ? (
                    <p className="mt-0.5 text-ink">{contactPhone(assigned)}</p>
                  ) : null}
                  <p className="mt-0.5 text-muted">
                    {contactAccountName(assigned, lead.empresa_nombre)}
                  </p>
                </div>
              ) : (
                <>
                  <select
                    className={`${inputClass} text-muted`}
                    disabled={!canEdit || isSaving}
                    value=""
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next) void persist(key, next);
                    }}
                  >
                    <option value="">Sin asignar</option>
                    {peopleOptions
                      .filter((person) => person.tipo_influencia === key)
                      .map((person) => (
                        <option key={person.person_id} value={person.person_id}>
                          {person.name}
                        </option>
                      ))}
                  </select>
                  {canEdit && accountId ? (
                    <button
                      type="button"
                      className="mt-2 text-xs font-bold text-accent hover:underline"
                      onClick={() => setAddSlot(key)}
                    >
                      + Agregar contacto
                    </button>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>

      {addSlot && accountId ? (
        <AddContactModal
          accountId={accountId}
          tipo={addSlot}
          people={accountPeople.filter(
            (person) => resolvePersonInfluenciaTipo(person) === addSlot,
          )}
          tipoLabel={
            LEAD_INFLUENCIA_SLOTS.find((slot) => slot.key === addSlot)
              ?.label ?? addSlot
          }
          onClose={() => setAddSlot(null)}
          onPicked={async (personId) => {
            const slot = addSlot;
            setAddSlot(null);
            await persist(slot, personId);
          }}
        />
      ) : null}
    </section>
  );
}

function AddContactModal({
  accountId,
  tipo,
  people,
  tipoLabel,
  onClose,
  onPicked,
}: {
  accountId: string;
  tipo: LeadInfluenciaKey;
  people: Person[];
  tipoLabel: string;
  onClose: () => void;
  onPicked: (personId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = people.filter((person) => {
    const haystack = `${person.name} ${person.email ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  async function createAndAssign() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createPerson({
        name: trimmed,
        job_title: jobTitle.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        account_id: accountId,
        tipo_influencia: tipo,
      });
      savePersonInfluenciaTipo(created.person_id, tipo);
      await onPicked(created.person_id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo crear el contacto.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Agregar contacto — ${tipoLabel}`} onClose={onClose}>
      {error ? (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="lead-inf-search">
            Buscar contacto existente
          </label>
          <input
            id="lead-inf-search"
            className={inputClass}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre o email"
          />
          <ul className="mt-2 max-h-36 overflow-y-auto rounded border border-border">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted">
                Sin coincidencias con esta tipología. Defínela en Contactos.
              </li>
            ) : (
              matches.map((person) => (
                <li key={person.person_id}>
                  <button
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-bg"
                    onClick={() => void onPicked(person.person_id)}
                  >
                    <span className="font-bold text-ink">{person.name}</span>
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
        </div>

        <p className="text-xs font-bold text-ink">O crear uno nuevo</p>
        <div>
          <label className={labelClass} htmlFor="lead-inf-name">
            Nombre
          </label>
          <input
            id="lead-inf-name"
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="lead-inf-job">
            Cargo
          </label>
          <input
            id="lead-inf-job"
            className={inputClass}
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="lead-inf-email">
            Email
          </label>
          <input
            id="lead-inf-email"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="lead-inf-phone">
            Teléfono
          </label>
          <input
            id="lead-inf-phone"
            className={inputClass}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={saving}
            onClick={() => void createAndAssign()}
          >
            {saving ? 'Guardando…' : 'Crear y asignar'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
