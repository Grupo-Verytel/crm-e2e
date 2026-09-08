import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { fetchPeople } from '../../../accounts/api/accounts-api';
import type { Person } from '../../../accounts/types';
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
import { inputClass, labelClass } from '../ui';

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
    const assignedElsewhere = new Set(
      lead.contacts
        .filter((contact) => contact.tipo_influencia)
        .map((contact) => contact.person_id),
    );
    const byId = new Map<string, { person_id: string; name: string }>();
    for (const person of accountPeople) {
      byId.set(person.person_id, {
        person_id: person.person_id,
        name: person.name,
      });
    }
    for (const contact of lead.contacts) {
      if (!byId.has(contact.person_id)) {
        byId.set(contact.person_id, {
          person_id: contact.person_id,
          name: contactPersonName(contact),
        });
      }
    }
    return [...byId.values()]
      .filter((person) => !assignedElsewhere.has(person.person_id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accountPeople, lead.contacts]);

  async function persist(tipo: LeadInfluenciaKey, personId: string | null) {
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
        contactos de la empresa que aún no están en otro rol.
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
                    {peopleOptions.map((person) => (
                      <option key={person.person_id} value={person.person_id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                  {canEdit && accountId ? (
                    <Link
                      to={`/accounts/contactos?account_id=${encodeURIComponent(accountId)}&new=1`}
                      className="mt-2 inline-block text-xs font-bold text-accent hover:underline"
                    >
                      + Agregar contacto
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
