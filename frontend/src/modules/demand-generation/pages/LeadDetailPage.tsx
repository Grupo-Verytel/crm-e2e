import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  discardLead,
  fetchLead,
  recycleLead,
  transitionLeadToMofu,
  transitionLeadToMql,
} from '../api/leads-api';
import { ChecklistPanel } from '../components/ChecklistPanel';
import { DemandNav } from '../components/DemandNav';
import { InteractionTimeline } from '../components/InteractionTimeline';
import { MotivoModal } from '../components/MotivoModal';
import { StatusBadge } from '../components/StatusBadge';
import { cardClass, ghostButtonClass, primaryButtonClass } from '../components/ui';
import { ExpectedRoute } from '../components/leads/ExpectedRoute';
import { CANAL_ORIGEN_LABEL } from '../lib/lead-vocab';
import type { Lead } from '../types';

export function LeadDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);

  const loadLead = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setLead(await fetchLead(id));
    } catch {
      setError('No se pudo cargar el lead.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/param change
    void loadLead();
  }, [loadLead]);

  async function runAction(action: () => Promise<Lead>) {
    setActionError(null);
    try {
      setLead(await action());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo completar la acción.');
    }
  }

  if (isLoading) {
    return (
      <AppLayout title="Lead">
        <DemandNav />
        <p className="px-6 py-10 text-center text-sm text-muted">Cargando lead…</p>
      </AppLayout>
    );
  }

  if (error || !lead) {
    return (
      <AppLayout title="Lead">
        <DemandNav />
        <p className="px-6 py-10 text-center text-sm text-muted">
          {error ?? 'Lead no encontrado.'}
        </p>
      </AppLayout>
    );
  }

  const canDiscard =
    lead.estado !== 'SQL' && lead.estado !== 'Descartado';

  return (
    <AppLayout title={lead.empresa_nombre}>
      <DemandNav />

      <Link to="/demand" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← Volver a leads
      </Link>

      <div className={`${cardClass} mb-4 p-5`}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-ink">{lead.empresa_nombre}</h1>
            <p className="text-sm text-muted">
              {lead.contacto_nombre} · {lead.email}
            </p>
          </div>
          <StatusBadge value={lead.estado} />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Detail label="Segmento" value={lead.segmento} />
          <Detail label="Industria" value={lead.industria ?? '—'} />
          <Detail label="Región" value={lead.region} />
          <Detail label="Origen" value={lead.origen} />
          <Detail
            label="Canal de origen"
            value={CANAL_ORIGEN_LABEL[lead.canal_origen]}
          />
          <Detail label="Teléfono" value={lead.telefono ?? '—'} />
          <Detail label="NIT" value={lead.nit ?? '—'} />
          <Detail label="Captura" value={formatDateTime(lead.fecha_captura)} />
          <Detail
            label="Última interacción"
            value={formatDateTime(lead.fecha_ultima_interaccion)}
          />
        </dl>

        <section className="mt-5 border-t border-border pt-4">
          <h2 className="mb-3 text-sm font-bold text-ink">
            Contactos ({lead.contacts.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lead.contacts.map((contact) => (
              <div
                key={contact.contact_id}
                className="rounded border border-border bg-bg p-3 text-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink">{contact.nombre}</p>
                    <p className="text-xs text-muted">
                      {contact.cargo ?? 'Sin cargo'} · {contact.empresa_nombre}
                    </p>
                  </div>
                  {contact.position === 1 ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-bold text-muted">
                      Principal
                    </span>
                  ) : null}
                </div>
                <a
                  href={`mailto:${contact.email}`}
                  className="block truncate text-brand hover:text-brand-700"
                >
                  {contact.email}
                </a>
                {contact.telefono ? (
                  <a
                    href={`tel:${contact.telefono}`}
                    className="mt-1 block text-ink hover:text-brand"
                  >
                    {contact.telefono}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-4">
          <ExpectedRoute
            canalOrigen={lead.canal_origen}
            currentState={lead.estado}
          />
        </div>

        {lead.motivo_descarte ? (
          <p className="mt-3 text-sm text-danger">
            Motivo de descarte: {lead.motivo_descarte}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {lead.estado === 'TOFU' && lead.canal_origen !== 'FABRICA' ? (
            <button
              type="button"
              onClick={() => runAction(() => transitionLeadToMofu(lead.lead_id))}
              className={primaryButtonClass}
            >
              Pasar a MOFU
            </button>
          ) : null}

          {(lead.estado === 'MOFU' &&
            lead.canal_origen !== 'GENERACION_DEMANDA_AGENCIA') ||
          (lead.estado === 'TOFU' && lead.canal_origen === 'FABRICA') ? (
            <button
              type="button"
              onClick={() => runAction(() => transitionLeadToMql(lead.lead_id))}
              className={primaryButtonClass}
            >
              Enviar a MQL
            </button>
          ) : null}

          {(lead.estado === 'Descartado' || lead.estado === 'Reciclaje') && user ? (
            <button
              type="button"
              onClick={() => runAction(() => recycleLead(lead.lead_id, user.user_id))}
              className={ghostButtonClass}
            >
              Reciclar a MOFU
            </button>
          ) : null}

          {canDiscard ? (
            <button
              type="button"
              onClick={() => setShowDiscard(true)}
              className={ghostButtonClass}
            >
              Descartar
            </button>
          ) : null}
        </div>

        {lead.estado === 'MQL_PENDING' ? (
          <p className="mt-3 text-xs text-muted">
            En revisión del Director de Mercadeo. El lead es de solo lectura.
          </p>
        ) : null}

        {actionError ? (
          <p className="mt-3 text-sm text-danger">{actionError}</p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChecklistPanel
          key={`checklist-${lead.estado}`}
          leadId={lead.lead_id}
          editable={
            lead.estado === 'MOFU' ||
            (lead.estado === 'TOFU' && lead.canal_origen === 'FABRICA')
          }
          onSaved={loadLead}
        />
        <InteractionTimeline leadId={lead.lead_id} onRegistered={loadLead} />
      </div>

      {showDiscard ? (
        <MotivoModal
          title="Descartar lead"
          confirmLabel="Descartar"
          onConfirm={async (motivo) => {
            setLead(await discardLead(lead.lead_id, motivo));
          }}
          onClose={() => setShowDiscard(false)}
        />
      ) : null}
    </AppLayout>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
