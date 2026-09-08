import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import { ColombiaCitySearchField } from '../../discovery/components/ColombiaCitySearchField';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  discardLead,
  fetchChecklist,
  fetchLead,
  recycleLead,
  transitionLeadToMofu,
  transitionLeadToMql,
  updateLead,
} from '../api/leads-api';
import { ChecklistPanel } from '../components/ChecklistPanel';
import { DemandNav } from '../components/DemandNav';
import { InteractionTimeline } from '../components/InteractionTimeline';
import {
  LeadDetailNav,
  type LeadDetailTab,
} from '../components/LeadDetailNav';
import { MotivoModal } from '../components/MotivoModal';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
} from '../components/ui';
import { ExpectedRoute } from '../components/leads/ExpectedRoute';
import { LeadConfigMenu } from '../components/leads/LeadConfigMenu';
import { ChecklistModal } from '../components/leads/ChecklistModal';
import { RegisterAppointmentModal } from '../components/leads/RegisterAppointmentModal';
import { LeadInfluenciasPanel } from '../components/leads/LeadInfluenciasPanel';
import { CANAL_ORIGEN_LABEL, leadDisplayName } from '../lib/lead-vocab';
import { contactAccountName } from '../lib/contact-display';
import type { Checklist, Lead, OrigenLead, Segmento } from '../types';
import { ORIGENES_LEAD, SEGMENTOS } from '../types';

function isChecklistComplete(checklist: Checklist | null): boolean {
  return (
    !!checklist &&
    checklist.criterio_sector_objetivo &&
    checklist.criterio_necesidad_portafolio &&
    checklist.criterio_acceso_decisor &&
    checklist.criterio_presupuesto_indicios
  );
}

type LeadEditDraft = {
  segmento: Segmento;
  industria: string;
  city: string;
  region: string;
  origen: OrigenLead;
  nit: string;
};

function draftFromLead(lead: Lead): LeadEditDraft {
  return {
    segmento: lead.segmento as Segmento,
    industria: lead.industria ?? '',
    city: lead.city ?? '',
    region: lead.region,
    origen: lead.origen as OrigenLead,
    nit: lead.nit ?? '',
  };
}

export function LeadDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTraductor = user?.role_name === 'TraductorDeNegocio';
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [showAppointment, setShowAppointment] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [detailTab, setDetailTab] = useState<LeadDetailTab>('detalle');
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<LeadEditDraft | null>(null);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (lead && editMode) {
      setDraft(draftFromLead(lead));
    }
  }, [lead, editMode]);

  async function runAction(action: () => Promise<Lead>) {
    setActionError(null);
    try {
      setLead(await action());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo completar la acción.');
    }
  }

  /** Spec §4: MOFU → BOFU (or FABRICA TOFU → BOFU) via complete checklist. */
  async function advanceToBofu() {
    setActionError(null);
    try {
      const checklist = await fetchChecklist(lead!.lead_id);
      if (isChecklistComplete(checklist)) {
        setLead(await transitionLeadToMql(lead!.lead_id));
        return;
      }
      setShowChecklist(true);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo avanzar a BOFU.',
      );
    }
  }

  function advanceZone() {
    if (!lead) return;
    if (lead.estado === 'TOFU' && lead.canal_origen !== 'FABRICA') {
      void runAction(() => transitionLeadToMofu(lead.lead_id));
      return;
    }
    if (
      (lead.estado === 'MOFU' &&
        lead.canal_origen !== 'GENERACION_DEMANDA_AGENCIA') ||
      (lead.estado === 'TOFU' && lead.canal_origen === 'FABRICA')
    ) {
      void advanceToBofu();
      return;
    }
    if (
      lead.estado === 'MOFU' &&
      lead.canal_origen === 'GENERACION_DEMANDA_AGENCIA'
    ) {
      setShowAppointment(true);
    }
  }

  async function toggleEditMode() {
    if (!lead) return;

    if (!editMode) {
      setDraft(draftFromLead(lead));
      setEditMode(true);
      return;
    }

    if (!draft) {
      setEditMode(false);
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const updated = await updateLead(lead.lead_id, {
        segmento: draft.segmento,
        industria: draft.industria.trim() || undefined,
        city: draft.city.trim() || undefined,
        region: draft.region,
        origen: draft.origen,
        nit: draft.nit.trim() || undefined,
        pais: 'CO',
      });
      setLead(updated);
      setEditMode(false);
      setDraft(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo guardar el lead.',
      );
    } finally {
      setSaving(false);
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
    !isTraductor &&
    lead.estado !== 'SQL' &&
    lead.estado !== 'Descartado';

  const canEdit =
    !isTraductor &&
    lead.estado !== 'Descartado' &&
    lead.estado !== 'MQL_PENDING' &&
    lead.estado !== 'SQL';

  const canPassToMofu =
    lead.estado === 'TOFU' && lead.canal_origen !== 'FABRICA';

  const isAgencyMofu =
    lead.estado === 'MOFU' &&
    lead.canal_origen === 'GENERACION_DEMANDA_AGENCIA';

  const canAdvanceViaChecklist =
    (lead.estado === 'MOFU' &&
      lead.canal_origen !== 'GENERACION_DEMANDA_AGENCIA') ||
    (lead.estado === 'TOFU' && lead.canal_origen === 'FABRICA');

  const canRegisterAppointment =
    isAgencyMofu &&
    (user?.role_name === 'SoporteComercial' ||
      user?.role_name === 'GestorMercadeo' ||
      user?.role_name === 'Admin');

  const canAvanzar =
    !isTraductor &&
    (canPassToMofu || canAdvanceViaChecklist || canRegisterAppointment);

  const primaryContact = lead.contacts[0];
  const headerCompany =
    primaryContact != null
      ? contactAccountName(primaryContact, lead.empresa_nombre)
      : lead.empresa_nombre;
  const headerTitle = leadDisplayName(lead);

  return (
    <AppLayout title={headerTitle}>
      <DemandNav />

      <Link to="/demand" className="mb-3 inline-block text-sm text-muted hover:text-ink">
        ← Volver a leads
      </Link>

      <ExpectedRoute
        canalOrigen={lead.canal_origen}
        currentState={lead.estado}
        stageSince={lead.fecha_ultima_interaccion ?? lead.fecha_captura}
      />

      <LeadDetailNav active={detailTab} onChange={setDetailTab} />

      {detailTab === 'interacciones' ? (
        <InteractionTimeline
          leadId={lead.lead_id}
          leadName={headerTitle}
          onRegistered={loadLead}
          readOnly={isTraductor}
        />
      ) : (
        <>
      <div
        className={[
          cardClass,
          'mb-4 p-5 transition-[box-shadow,border-color] duration-300',
          editMode ? 'ring-1 ring-accent/40' : '',
        ].join(' ')}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-ink">{headerTitle}</h1>
            <p className="text-sm text-muted">
              {headerCompany}
              {lead.contacto_nombre ? ` · ${lead.contacto_nombre}` : ''}
              {lead.email ? ` · ${lead.email}` : ''}
            </p>
            {editMode ? (
              <p className="mt-1 text-xs font-bold text-muted">
                {saving ? 'Guardando…' : 'Edición activa'}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isTraductor ? (
              <LeadConfigMenu
                canEdit={canEdit}
                canAvanzar={canAvanzar}
                canDelete={canDiscard}
                onEditar={() => void toggleEditMode()}
                onAvanzar={advanceZone}
                onEliminar={() => setShowDiscard(true)}
              />
            ) : null}
          </div>
        </div>

        {editMode && draft ? (
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>
              <label className={labelClass} htmlFor="lead-segmento">
                Segmento
              </label>
              <select
                id="lead-segmento"
                className={inputClass}
                value={draft.segmento}
                onChange={(e) =>
                  setDraft({ ...draft, segmento: e.target.value as Segmento })
                }
              >
                {SEGMENTOS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="lead-industria">
                Industria
              </label>
              <input
                id="lead-industria"
                className={inputClass}
                value={draft.industria}
                onChange={(e) =>
                  setDraft({ ...draft, industria: e.target.value })
                }
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className={labelClass} htmlFor="lead-ciudad">
                Ciudad
              </label>
              <ColombiaCitySearchField
                id="lead-ciudad"
                value={draft.city}
                departamento={draft.region}
                onSelect={(row) =>
                  setDraft({
                    ...draft,
                    city: row.municipio,
                    region: row.departamento,
                  })
                }
                onClear={() =>
                  setDraft({ ...draft, city: '', region: draft.region })
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="lead-region">
                Región
              </label>
              <input
                id="lead-region"
                className={inputClass}
                value={draft.region}
                readOnly
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="lead-origen">
                Origen
              </label>
              <select
                id="lead-origen"
                className={inputClass}
                value={draft.origen}
                onChange={(e) =>
                  setDraft({ ...draft, origen: e.target.value as OrigenLead })
                }
              >
                {ORIGENES_LEAD.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={labelClass}>Canal de origen</span>
              <p className="flex h-9 items-center text-ink">
                {CANAL_ORIGEN_LABEL[lead.canal_origen]}
              </p>
            </div>
            <div>
              <span className={labelClass}>Teléfono</span>
              <p className="flex h-9 items-center text-ink">
                {lead.telefono ?? '—'}
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="lead-nit">
                NIT
              </label>
              <input
                id="lead-nit"
                className={inputClass}
                value={draft.nit}
                onChange={(e) => setDraft({ ...draft, nit: e.target.value })}
              />
            </div>
            <div>
              <span className={labelClass}>Captura</span>
              <p className="flex h-9 items-center text-ink">
                {formatDateTime(lead.fecha_captura)}
              </p>
            </div>
            <div>
              <span className={labelClass}>Última interacción</span>
              <p className="flex h-9 items-center text-ink">
                {formatDateTime(lead.fecha_ultima_interaccion)}
              </p>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Detail label="Segmento" value={lead.segmento} />
            <Detail label="Industria" value={lead.industria ?? '—'} />
            <Detail label="Ciudad" value={lead.city ?? '—'} />
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
        )}

        <LeadInfluenciasPanel
          lead={lead}
          canEdit={canEdit}
          onLeadChange={setLead}
          onError={setActionError}
        />

        {lead.motivo_descarte ? (
          <p className="mt-3 text-sm text-danger">
            Motivo de descarte: {lead.motivo_descarte}
          </p>
        ) : null}

        {!isTraductor ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {isAgencyMofu && !canRegisterAppointment ? (
            <p className="w-full text-sm text-muted">
              Este lead de agencia avanza a BOFU registrando una cita (Gestor de
              Mercadeo o Soporte Comercial) desde el detalle o la{' '}
              <Link to="/demand/agenda" className="font-bold text-accent hover:underline">
                Bandeja de Agenda
              </Link>
              .
            </p>
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
        </div>
        ) : (
          <p className="mt-5 text-sm text-muted">
            Vista de solo lectura para traductores de negocio.
          </p>
        )}

        {lead.estado === 'MQL_PENDING' ? (
          <p className="mt-3 text-xs text-muted">
            En revisión del Director de Mercadeo. El lead es de solo lectura.
          </p>
        ) : null}

        {actionError ? (
          <p className="mt-3 text-sm text-danger">{actionError}</p>
        ) : null}
      </div>

      <ChecklistPanel
        key={`checklist-${lead.estado}`}
        leadId={lead.lead_id}
        editable={
          !isTraductor &&
          (lead.estado === 'MOFU' ||
            (lead.estado === 'TOFU' && lead.canal_origen === 'FABRICA'))
        }
        onSaved={loadLead}
      />
        </>
      )}

      {showDiscard ? (
        <MotivoModal
          title="Eliminar lead"
          confirmLabel="Eliminar"
          onConfirm={async (motivo) => {
            await discardLead(lead.lead_id, motivo);
            navigate('/demand');
          }}
          onClose={() => setShowDiscard(false)}
        />
      ) : null}

      {showAppointment ? (
        <RegisterAppointmentModal
          lead={lead}
          onRegistered={(updated) => {
            setLead(updated);
            setShowAppointment(false);
          }}
          onClose={() => setShowAppointment(false)}
        />
      ) : null}

      {showChecklist ? (
        <ChecklistModal
          leadId={lead.lead_id}
          leadName={leadDisplayName(lead)}
          onQualified={async () => {
            await loadLead();
          }}
          onSaved={async () => {
            await loadLead();
          }}
          onClose={() => setShowChecklist(false)}
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
