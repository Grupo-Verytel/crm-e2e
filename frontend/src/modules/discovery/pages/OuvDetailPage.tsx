import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import {
  IN_APP_NOTIFICATION_EVENT,
  type InAppNotificationEventDetail,
} from '../../../lib/notification-events';
import { ApiError } from '../../auth/types';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  createOuvContacto,
  deleteOuvContacto,
  fetchOuv,
  fetchOuvChecklist,
  fetchOuvContactos,
  fetchOuvInfluencias,
  marcarChecklistItem,
  updateOuv,
  updateOuvContacto,
  updateOuvInfluencia,
  updateOuvPresupuesto,
  type ContactoPayload,
  type Ouv,
  type OuvChecklistItem,
  type OuvContacto,
  type OuvInfluencia,
  type UpdateOuvPayload,
} from '../api/ouvs-api';
import { AvanceZonaModal } from '../components/AvanceZonaModal';
import { CierreOuvModal } from '../components/CierreOuvModal';
import { ContactoFormModal } from '../components/ContactoFormModal';
import { ContactosSidePanel } from '../components/ContactosSidePanel';
import { EditOuvModal } from '../components/EditOuvModal';
import { OuvDetailHeader } from '../components/OuvDetailHeader';
import { OuvZonaStepper } from '../components/OuvZonaStepper';
import { InteraccionesPreventaPanel } from '../components/InteraccionesPreventaPanel';
import { PreventaActivityPanel } from '../components/PreventaActivityPanel';
import { RetrocesoZonaModal } from '../components/RetrocesoZonaModal';
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  tabActiveClass,
  tabClass,
} from '../components/ui';
import {
  INFLUENCIA_ESTADO_CARD,
  INFLUENCIA_ESTADO_DOT,
  INFLUENCIA_ESTADO_LABEL,
  INFLUENCIA_ESTADOS,
  INFLUENCIA_TIPO_LABEL,
  INFLUENCIA_TIPOS,
  isOuvNotificationEvent,
  type InfluenciaEstado,
  type InfluenciaTipo,
} from '../lib/ouv-vocab';

type DetailTab = 'detalle' | 'preventa' | 'interacciones';

/**
 * After a successful save for `justSavedTipo`, prefer that row from the server
 * but keep other local rows if they still have an in-flight save sequence
 * (avoid wiping a sibling card the user is mid-editing).
 */
function mergeInfluenciasPreferringNewerLocal(
  local: OuvInfluencia[],
  server: OuvInfluencia[],
  justSavedTipo: InfluenciaTipo,
): OuvInfluencia[] {
  const localByTipo = new Map(local.map((row) => [row.tipo, row]));
  return server.map((serverRow) => {
    if (serverRow.tipo === justSavedTipo) return serverRow;
    return localByTipo.get(serverRow.tipo) ?? serverRow;
  });
}

export function OuvDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();

  const [ouv, setOuv] = useState<Ouv | null>(null);
  const [contactos, setContactos] = useState<OuvContacto[]>([]);
  const [influencias, setInfluencias] = useState<OuvInfluencia[]>([]);
  const [checklist, setChecklist] = useState<OuvChecklistItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPresupuesto, setSavingPresupuesto] = useState(false);
  const [influenciaFlash, setInfluenciaFlash] = useState<InfluenciaTipo | null>(
    null,
  );
  const [savingTipos, setSavingTipos] = useState<
    Partial<Record<InfluenciaTipo, boolean>>
  >({});
  const influenciaFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const influenciaSaveSeq = useRef<Partial<Record<InfluenciaTipo, number>>>({});
  const notasDebounceTimers = useRef<
    Partial<Record<InfluenciaTipo, ReturnType<typeof setTimeout>>>
  >({});
  const influenciasRef = useRef<OuvInfluencia[]>([]);
  influenciasRef.current = influencias;
  const [contactoModal, setContactoModal] = useState<OuvContacto | null | 'new'>(
    null,
  );
  /** Cuando se abre el modal desde una card de influencia, el contacto recién
   *  creado se linkea automáticamente a ese tipo. */
  const [contactoModalContext, setContactoModalContext] =
    useState<InfluenciaTipo | null>(null);
  const [showContactosPanel, setShowContactosPanel] = useState(false);
  const [showAvance, setShowAvance] = useState(false);
  const [showRetroceso, setShowRetroceso] = useState(false);
  const [showCierre, setShowCierre] = useState(false);
  const [showEditOuv, setShowEditOuv] = useState(false);
  const [tab, setTab] = useState<DetailTab>('detalle');

  const [presupuestoConfirmado, setPresupuestoConfirmado] = useState(false);
  const [presupuestoMonto, setPresupuestoMonto] = useState('');
  const [presupuestoMoneda, setPresupuestoMoneda] = useState('COP');
  const [presupuestoFuente, setPresupuestoFuente] = useState('cliente_declaro');

  const contactoInfluenciaMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const inf of influencias) {
      if (!inf.contacto_ouv_id) continue;
      const list = map.get(inf.contacto_ouv_id) ?? [];
      list.push(inf.tipo);
      map.set(inf.contacto_ouv_id, list);
    }
    return map;
  }, [influencias]);

  const influenciasVerdeCount = useMemo(
    () => influencias.filter((inf) => inf.estado === 'Verde').length,
    [influencias],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!id) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const detail = await fetchOuv(id);
        setOuv(detail);
        setPresupuestoConfirmado(detail.presupuesto_confirmado);
        setPresupuestoMonto(detail.presupuesto_monto ?? '');
        setPresupuestoMoneda(detail.presupuesto_moneda ?? 'COP');
        setPresupuestoFuente(detail.presupuesto_fuente ?? 'cliente_declaro');

        const [c, i, ch] = await Promise.all([
          fetchOuvContactos(id),
          fetchOuvInfluencias(id),
          fetchOuvChecklist(id, detail.zona_actual),
        ]);
        setContactos(c);
        setInfluencias(i);
        setChecklist(ch);
      } catch {
        setError('No se pudo cargar la OUV.');
        setOuv(null);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onNotification(event: Event) {
      const detail = (event as CustomEvent<InAppNotificationEventDetail>)
        .detail;
      if (
        isOuvNotificationEvent(detail?.event_type) &&
        detail?.entity_id === id
      ) {
        void load({ silent: true });
      }
    }
    window.addEventListener(IN_APP_NOTIFICATION_EVENT, onNotification);
    return () =>
      window.removeEventListener(IN_APP_NOTIFICATION_EVENT, onNotification);
  }, [id, load]);

  useEffect(() => {
    return () => {
      if (influenciaFlashTimer.current) {
        clearTimeout(influenciaFlashTimer.current);
      }
      for (const timer of Object.values(notasDebounceTimers.current)) {
        if (timer) clearTimeout(timer);
      }
    };
  }, []);

  function flashInfluencia(tipo: InfluenciaTipo) {
    setInfluenciaFlash(tipo);
    if (influenciaFlashTimer.current) {
      clearTimeout(influenciaFlashTimer.current);
    }
    influenciaFlashTimer.current = setTimeout(() => {
      setInfluenciaFlash((current) => (current === tipo ? null : current));
    }, 1400);
  }

  function patchInfluenciaLocal(
    tipo: InfluenciaTipo,
    patch: Partial<
      Pick<
        OuvInfluencia,
        'estado' | 'contacto_ouv_id' | 'notas' | 'motivo_estado'
      >
    >,
  ): void {
    setInfluencias((prev) => {
      const next = prev.map((row) =>
        row.tipo === tipo ? { ...row, ...patch } : row,
      );
      influenciasRef.current = next;
      return next;
    });
  }

  async function persistInfluencia(
    tipo: InfluenciaTipo,
    snapshot: Pick<
      OuvInfluencia,
      'estado' | 'contacto_ouv_id' | 'notas' | 'motivo_estado'
    >,
  ) {
    if (!id) return;
    const seq = (influenciaSaveSeq.current[tipo] ?? 0) + 1;
    influenciaSaveSeq.current[tipo] = seq;
    setActionError(null);
    setSavingTipos((prev) => ({ ...prev, [tipo]: true }));
    try {
      await updateOuvInfluencia(id, tipo, {
        estado: snapshot.estado,
        contacto_ouv_id: snapshot.contacto_ouv_id,
        motivo_estado: snapshot.motivo_estado,
        notas: snapshot.notas,
      });
      if (influenciaSaveSeq.current[tipo] !== seq) return;

      // Refresh OUV (gap) without clobbering in-flight edits on other fields.
      const [detail, serverInfluencias] = await Promise.all([
        fetchOuv(id),
        fetchOuvInfluencias(id),
      ]);
      if (influenciaSaveSeq.current[tipo] !== seq) return;

      setOuv(detail);
      setInfluencias((local) =>
        mergeInfluenciasPreferringNewerLocal(local, serverInfluencias, tipo),
      );
      flashInfluencia(tipo);
    } catch (err) {
      if (influenciaSaveSeq.current[tipo] !== seq) return;
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo actualizar la influencia.',
      );
      try {
        const serverInfluencias = await fetchOuvInfluencias(id);
        if (influenciaSaveSeq.current[tipo] !== seq) return;
        setInfluencias(serverInfluencias);
      } catch {
        /* keep optimistic local state */
      }
    } finally {
      if (influenciaSaveSeq.current[tipo] === seq) {
        setSavingTipos((prev) => ({ ...prev, [tipo]: false }));
      }
    }
  }

  function handleInfluenciaFieldChange(
    tipo: InfluenciaTipo,
    patch: Partial<
      Pick<
        OuvInfluencia,
        'estado' | 'contacto_ouv_id' | 'notas' | 'motivo_estado'
      >
    >,
  ) {
    const current = influenciasRef.current.find((row) => row.tipo === tipo);
    if (!current) return;
    const snapshot = {
      estado: patch.estado ?? current.estado,
      contacto_ouv_id:
        patch.contacto_ouv_id !== undefined
          ? patch.contacto_ouv_id
          : current.contacto_ouv_id,
      notas: patch.notas !== undefined ? patch.notas : current.notas,
      motivo_estado:
        patch.motivo_estado !== undefined
          ? patch.motivo_estado
          : current.motivo_estado,
    };
    patchInfluenciaLocal(tipo, snapshot);
    void persistInfluencia(tipo, snapshot);
  }

  function handleInfluenciaNotasChange(tipo: InfluenciaTipo, notas: string) {
    const current = influenciasRef.current.find((row) => row.tipo === tipo);
    if (!current) return;
    patchInfluenciaLocal(tipo, { notas: notas || null });
    const existing = notasDebounceTimers.current[tipo];
    if (existing) clearTimeout(existing);
    notasDebounceTimers.current[tipo] = setTimeout(() => {
      const latest = influenciasRef.current.find((row) => row.tipo === tipo);
      if (!latest) return;
      void persistInfluencia(tipo, {
        estado: latest.estado,
        contacto_ouv_id: latest.contacto_ouv_id,
        notas: latest.notas,
        motivo_estado: latest.motivo_estado,
      });
    }, 500);
  }

  async function handleSaveContacto(payload: ContactoPayload) {
    if (!id) return;
    if (contactoModal && contactoModal !== 'new') {
      await updateOuvContacto(id, contactoModal.contacto_ouv_id, payload);
      await load({ silent: true });
      return;
    }
    const created = await createOuvContacto(id, payload);
    // Al crear desde una tarjeta de influencia, dejamos el contacto ya asignado
    // a ese tipo — así el usuario no tiene que volver a abrir el select.
    if (contactoModalContext) {
      const targetTipo = contactoModalContext;
      const current = influenciasRef.current.find(
        (row) => row.tipo === targetTipo,
      );
      patchInfluenciaLocal(targetTipo, {
        estado: current?.estado ?? 'SinEvaluar',
        contacto_ouv_id: created.contacto_ouv_id,
        notas: current?.notas ?? null,
        motivo_estado: current?.motivo_estado ?? null,
      });
      void persistInfluencia(targetTipo, {
        estado: current?.estado ?? 'SinEvaluar',
        contacto_ouv_id: created.contacto_ouv_id,
        notas: current?.notas ?? null,
        motivo_estado: current?.motivo_estado ?? null,
      });
    }
    await load({ silent: true });
  }

  function openContactoModal(
    target: OuvContacto | 'new',
    linkTipo: InfluenciaTipo | null = null,
  ) {
    setContactoModal(target);
    setContactoModalContext(target === 'new' ? linkTipo : null);
  }

  function closeContactoModal() {
    setContactoModal(null);
    setContactoModalContext(null);
  }

  async function handleDeleteContacto(contacto: OuvContacto) {
    if (!id) return;
    if (!window.confirm(`¿Eliminar contacto ${contacto.name}?`)) return;
    try {
      await deleteOuvContacto(id, contacto.contacto_ouv_id);
      await load({ silent: true });
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'No se pudo eliminar.',
      );
    }
  }

  async function handleSavePresupuesto() {
    if (!id) return;
    setActionError(null);
    setActionSuccess(null);
    setSavingPresupuesto(true);
    try {
      const monto = presupuestoMonto.trim();
      if (monto && Number.isNaN(Number(monto))) {
        throw new Error('El monto debe ser un número válido.');
      }
      await updateOuvPresupuesto(id, {
        presupuesto_confirmado: presupuestoConfirmado,
        presupuesto_monto: monto ? Number(monto) : null,
        presupuesto_moneda: presupuestoMoneda,
        presupuesto_fuente: presupuestoFuente,
        presupuesto_fecha_captura: new Date().toISOString(),
      });
      await load({ silent: true });
      setActionSuccess(
        presupuestoConfirmado
          ? 'Presupuesto guardado (confirmado).'
          : 'Presupuesto guardado.',
      );
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo guardar el presupuesto.',
      );
    } finally {
      setSavingPresupuesto(false);
    }
  }

  if (loading) {
    return (
      <AppLayout title="OUV">
        <p className="text-sm text-muted">Cargando…</p>
      </AppLayout>
    );
  }

  if (error || !ouv) {
    return (
      <AppLayout title="OUV">
        <p className="text-sm text-danger">{error ?? 'OUV no encontrada'}</p>
        <Link to="/opportunities" className="mt-3 inline-block text-accent">
          Volver a bandeja
        </Link>
      </AppLayout>
    );
  }

  const editable =
    ouv.resultado === 'EnCurso' && user?.user_id === ouv.comercial_id;
  const isSoporte =
    user?.role_name === 'SoporteComercial' || user?.role_name === 'Admin';

  return (
    <AppLayout title={ouv.consecutivo}>
      <div className="mb-4">
        <Link to="/opportunities" className="text-sm text-accent hover:underline">
          ← Bandeja OUV
        </Link>
      </div>

      <OuvZonaStepper
        zonaActual={ouv.zona_actual}
        createdAt={ouv.created_at}
      />

      <nav
        className="mb-4 flex flex-wrap gap-1 border-b border-border"
        aria-label="Secciones de la OUV"
      >
        <button
          type="button"
          className={tab === 'detalle' ? tabActiveClass : tabClass}
          aria-current={tab === 'detalle' ? 'page' : undefined}
          onClick={() => setTab('detalle')}
        >
          Detalle OUV
        </button>
        <button
          type="button"
          className={tab === 'preventa' ? tabActiveClass : tabClass}
          aria-current={tab === 'preventa' ? 'page' : undefined}
          onClick={() => setTab('preventa')}
        >
          Solicitudes Preventa
        </button>
        <button
          type="button"
          className={tab === 'interacciones' ? tabActiveClass : tabClass}
          aria-current={tab === 'interacciones' ? 'page' : undefined}
          onClick={() => setTab('interacciones')}
        >
          Interacciones
        </button>
      </nav>

      {isSoporte && !editable ? (
        <p className="mb-3 rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          Vista Soporte: lectura de OUV. La edición de zona/cierre es del
          comercial dueño.
        </p>
      ) : null}

      {tab === 'detalle' ? (
        <OuvDetailHeader
          ouv={ouv}
          editable={editable}
          contactosCount={contactos.length}
          onOpenContactos={() => setShowContactosPanel(true)}
          onEditar={() => setShowEditOuv(true)}
          onAvanzar={() => setShowAvance(true)}
          onRetroceder={() => setShowRetroceso(true)}
          onCerrar={() => setShowCierre(true)}
        />
      ) : null}

      {tab === 'detalle' && ouv.tiene_gap ? (
        <div className="mb-4 rounded border border-warning bg-warning/15 p-3 text-sm text-ink">
          Esta OUV tiene gap de criterios:{' '}
          {(ouv.criterios_faltantes ?? []).join(', ') || 'revisar zona actual'}.
        </div>
      ) : null}

      {actionError ? (
        <p className="mb-3 text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}
      {actionSuccess ? (
        <p className="mb-3 text-sm text-positive" role="status">
          {actionSuccess}
        </p>
      ) : null}

      {tab === 'detalle' ? (
      <>
      <section className={`${cardClass} mb-4 p-4`}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink">Influencias</h2>
            <p className="mt-1 text-xs text-muted">
              Asigna un contacto a cada rol (Económica, Técnica, Fábrica) y
              marca su estado. Se necesitan al menos{' '}
              <strong>2 en Verde</strong> para avanzar a EN_FUNNEL o
              MAYOR_PROBABILIDAD.
            </p>
          </div>
          <span
            className={[
              'inline-flex items-center rounded px-2 py-0.5 text-xs font-bold',
              influenciasVerdeCount >= 2
                ? 'bg-semaphore-verde/25 text-ink'
                : 'bg-warning/25 text-ink',
            ].join(' ')}
            aria-label={`${influenciasVerdeCount} de 3 influencias en Verde`}
          >
            {influenciasVerdeCount}/3 en Verde
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {INFLUENCIA_TIPOS.map((tipo) => {
            const inf = influencias.find((x) => x.tipo === tipo);
            const assignedContact = contactos.find(
              (c) => c.contacto_ouv_id === inf?.contacto_ouv_id,
            );
            const estado = (inf?.estado ??
              'SinEvaluar') as InfluenciaEstado;
            const cardTone =
              INFLUENCIA_ESTADO_CARD[estado] ??
              INFLUENCIA_ESTADO_CARD.SinEvaluar;
            const isUnassigned = !assignedContact;
            const isSaving = Boolean(savingTipos[tipo]);
            const justSaved = influenciaFlash === tipo;
            return (
              <div
                key={tipo}
                className={[
                  'rounded border p-3 transition-[border-color,box-shadow,opacity] duration-300',
                  isUnassigned ? 'border-border bg-bg/80 opacity-75' : cardTone,
                  justSaved
                    ? 'border-positive shadow-[0_0_0_1px_var(--positive)]'
                    : isSaving
                      ? 'border-accent'
                      : '',
                ].join(' ')}
                aria-live="polite"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p
                    className={`text-sm font-bold ${
                      isUnassigned ? 'text-muted' : 'text-ink'
                    }`}
                  >
                    {INFLUENCIA_TIPO_LABEL[tipo]}
                  </p>
                  {isSaving ? (
                    <span className="text-xs font-bold text-accent">
                      Guardando…
                    </span>
                  ) : null}
                  {!isSaving && justSaved ? (
                    <span className="text-xs font-bold text-positive">
                      Guardado
                    </span>
                  ) : null}
                  {!isSaving && !justSaved && isUnassigned ? (
                    <span className="text-xs font-bold text-muted">
                      Sin registrar
                    </span>
                  ) : null}
                </div>

                <label className={labelClass}>Contacto</label>
                {assignedContact ? (
                  <div className="relative rounded border border-border bg-surface p-2.5 pr-8 text-xs">
                    {editable ? (
                      <button
                        type="button"
                        className="icon-btn absolute right-1 top-1 grid h-6 w-6 place-items-center rounded text-muted hover:text-danger"
                        aria-label={`Quitar contacto de ${INFLUENCIA_TIPO_LABEL[tipo]}`}
                        onClick={() =>
                          handleInfluenciaFieldChange(tipo, {
                            contacto_ouv_id: null,
                          })
                        }
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    ) : null}
                    <p className="font-bold text-ink">{assignedContact.name}</p>
                    {assignedContact.job_title ? (
                      <p className="mt-0.5 text-muted">
                        {assignedContact.job_title}
                      </p>
                    ) : null}
                    {assignedContact.email ? (
                      <p className="mt-0.5 text-ink">{assignedContact.email}</p>
                    ) : null}
                    {assignedContact.phone ? (
                      <p className="mt-0.5 text-ink">{assignedContact.phone}</p>
                    ) : null}
                    {assignedContact.account_name ? (
                      <p className="mt-0.5 text-muted">
                        {assignedContact.account_name}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <select
                      className={`${inputClass} text-muted`}
                      disabled={!editable}
                      value={inf?.contacto_ouv_id ?? ''}
                      onChange={(e) =>
                        handleInfluenciaFieldChange(tipo, {
                          contacto_ouv_id: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Sin asignar</option>
                      {contactos.map((c) => (
                        <option
                          key={c.contacto_ouv_id}
                          value={c.contacto_ouv_id}
                        >
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {editable ? (
                      <button
                        type="button"
                        className="mt-2 text-xs font-bold text-accent hover:underline"
                        onClick={() => openContactoModal('new', tipo)}
                      >
                        + Agregar contacto
                      </button>
                    ) : null}
                  </>
                )}

                <label className={`${labelClass} mt-3`}>Estado</label>
                <div className="relative">
                  <span
                    className={`pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${
                      INFLUENCIA_ESTADO_DOT[estado] ??
                      INFLUENCIA_ESTADO_DOT.SinEvaluar
                    }`}
                    aria-hidden
                  />
                  <select
                    className={`${inputClass} pl-7 disabled:opacity-60`}
                    disabled={!editable}
                    value={estado}
                    onChange={(e) =>
                      handleInfluenciaFieldChange(tipo, {
                        estado: e.target.value,
                      })
                    }
                  >
                    {INFLUENCIA_ESTADOS.map((s) => (
                      <option key={s} value={s}>
                        {INFLUENCIA_ESTADO_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <label className={`${labelClass} mt-2`}>Notas</label>
                <textarea
                  className={`${inputClass} h-20 resize-y py-2`}
                  disabled={!editable}
                  value={inf?.notas ?? ''}
                  onChange={(e) =>
                    handleInfluenciaNotasChange(tipo, e.target.value)
                  }
                  onBlur={() => {
                    const pending = notasDebounceTimers.current[tipo];
                    if (pending) {
                      clearTimeout(pending);
                      notasDebounceTimers.current[tipo] = undefined;
                      const latest = influenciasRef.current.find(
                        (row) => row.tipo === tipo,
                      );
                      if (!latest) return;
                      void persistInfluencia(tipo, {
                        estado: latest.estado,
                        contacto_ouv_id: latest.contacto_ouv_id,
                        notas: latest.notas,
                        motivo_estado: latest.motivo_estado,
                      });
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className={`${cardClass} mb-4 border border-border p-4`}>
        <h2 className="mb-3 text-sm font-bold text-ink">Presupuesto</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <span className={labelClass}>Confirmado</span>
            <label className="flex h-9 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={presupuestoConfirmado}
                disabled={!editable}
                onChange={(e) => {
                  setPresupuestoConfirmado(e.target.checked);
                  setActionSuccess(null);
                }}
              />
              Confirmado
            </label>
          </div>
          <div>
            <label className={labelClass}>Monto</label>
            <input
              className={inputClass}
              value={presupuestoMonto}
              disabled={!editable}
              onChange={(e) => {
                setPresupuestoMonto(e.target.value);
                setActionSuccess(null);
              }}
            />
          </div>
          <div>
            <label className={labelClass}>Moneda</label>
            <select
              className={inputClass}
              value={presupuestoMoneda}
              disabled={!editable}
              onChange={(e) => {
                setPresupuestoMoneda(e.target.value);
                setActionSuccess(null);
              }}
            >
              <option value="COP">COP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Fuente</label>
            <select
              className={inputClass}
              value={presupuestoFuente}
              disabled={!editable}
              onChange={(e) => {
                setPresupuestoFuente(e.target.value);
                setActionSuccess(null);
              }}
            >
              <option value="cliente_declaro">Cliente declara</option>
              <option value="contrato_previo">Contrato previo</option>
              <option value="licitacion_publicada">Licitación</option>
              <option value="estimacion_comercial">Estimación</option>
              <option value="sin_verificar">Sin verificar</option>
            </select>
          </div>
        </div>
        {ouv.presupuesto_fecha_captura ? (
          <p className="mt-2 text-xs text-muted">
            Última captura: {formatDateTime(ouv.presupuesto_fecha_captura)}
            {ouv.presupuesto_confirmado ? ' · Confirmado' : ' · Sin confirmar'}
          </p>
        ) : null}
        {editable ? (
          <button
            type="button"
            className={`${primaryButtonClass} mt-3`}
            disabled={savingPresupuesto}
            onClick={() => void handleSavePresupuesto()}
          >
            {savingPresupuesto ? 'Guardando…' : 'Guardar presupuesto'}
          </button>
        ) : (
          <p className="mt-3 text-xs text-muted">
            Solo el comercial dueño puede guardar el presupuesto.
          </p>
        )}
      </section>

      <section className={`${cardClass} mb-4 border border-border p-4`}>
        <h2 className="mb-1 text-sm font-bold text-ink">
          Checklist — zona actual
        </h2>
        <p className="mb-3 text-xs text-muted">
          Se guarda al marcar o desmarcar cada ítem.
        </p>
        {checklist.length === 0 ? (
          <p className="text-sm text-muted">
            Sin items (siembra plantillas desde admin).
          </p>
        ) : (
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.item_id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.marcado}
                  disabled={!editable}
                  onChange={(e) => {
                    void marcarChecklistItem(
                      ouv.ouv_id,
                      item.item_id,
                      e.target.checked,
                    )
                      .then(() => load({ silent: true }))
                      .catch((err: unknown) =>
                        setActionError(
                          err instanceof ApiError
                            ? err.message
                            : 'Error al marcar checklist',
                        ),
                      );
                  }}
                />
                <span className="text-ink">{item.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ouv.resultado !== 'EnCurso' ? (
        <section className={`${cardClass} mb-4 border border-border p-4`}>
          <h2 className="mb-3 text-sm font-bold text-ink">Cierre</h2>
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="text-muted">Resultado</dt>
              <dd className="font-bold text-ink">{ouv.resultado}</dd>
            </div>
            <div>
              <dt className="text-muted">Fecha</dt>
              <dd className="text-ink">{formatDateTime(ouv.fecha_cierre)}</dd>
            </div>
            <div>
              <dt className="text-muted">Motivo</dt>
              <dd className="text-ink">{ouv.motivo_snapshot ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Monto</dt>
              <dd className="text-ink">
                {ouv.monto_final
                  ? `${ouv.monto_final} ${ouv.moneda_final ?? ''}`
                  : ouv.monto_estimado_perdido
                    ? `${ouv.monto_estimado_perdido} (estimado)`
                    : '—'}
              </dd>
            </div>
            {ouv.competidor_ganador ? (
              <div>
                <dt className="text-muted">Competidor</dt>
                <dd className="text-ink">{ouv.competidor_ganador}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
      </>
      ) : null}

      {tab === 'preventa' ? <PreventaActivityPanel ouv={ouv} /> : null}
      {tab === 'interacciones' ? (
        <InteraccionesPreventaPanel ouv={ouv} />
      ) : null}

      {contactoModal ? (
        <ContactoFormModal
          initial={contactoModal === 'new' ? null : contactoModal}
          lockAccountId={ouv.account_id}
          onClose={closeContactoModal}
          onSave={handleSaveContacto}
        />
      ) : null}
      <ContactosSidePanel
        open={showContactosPanel}
        contactos={contactos}
        influenciaByContacto={contactoInfluenciaMap}
        editable={editable}
        onClose={() => setShowContactosPanel(false)}
        onAdd={() => openContactoModal('new')}
        onEdit={(c) => openContactoModal(c)}
        onDelete={(c) => void handleDeleteContacto(c)}
      />
      {showAvance ? (
        <AvanceZonaModal
          ouv={ouv}
          onClose={() => setShowAvance(false)}
          onAdvanced={() => void load({ silent: true })}
        />
      ) : null}
      {showRetroceso ? (
        <RetrocesoZonaModal
          ouv={ouv}
          onClose={() => setShowRetroceso(false)}
          onRetrocedido={() => void load({ silent: true })}
        />
      ) : null}
      {showCierre ? (
        <CierreOuvModal
          ouv={ouv}
          onClose={() => setShowCierre(false)}
          onClosed={() => void load({ silent: true })}
        />
      ) : null}
      {showEditOuv ? (
        <EditOuvModal
          ouv={ouv}
          actorRoleName={user?.role_name}
          onClose={() => setShowEditOuv(false)}
          save={(payload: UpdateOuvPayload) => updateOuv(ouv.ouv_id, payload)}
          onSaved={(updated) => {
            setOuv(updated);
            setShowEditOuv(false);
            setActionSuccess('OUV actualizada.');
            void load({ silent: true });
          }}
        />
      ) : null}
    </AppLayout>
  );
}

export default OuvDetailPage;
