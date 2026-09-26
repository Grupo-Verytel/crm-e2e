import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import {
  formatAmountEsCo,
  formatAmountInputEsCo,
  formatDateTime,
  parseAmountInputEsCo,
} from '../../../lib/format';
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
  fetchOuvContactos,
  agregarInfluenciaContacto,
  calificarInfluenciaContacto,
  editarNotaInfluenciaContacto,
  EMPTY_INFLUENCIA_FILTRO,
  fetchOuvInfluencias,
  quitarInfluenciaContacto,
  updateOuv,
  updateOuvContacto,
  updateOuvPresupuesto,
  type ContactoPayload,
  type Ouv,
  type OuvContacto,
  type OuvInfluencia,
  type OuvInfluenciaFiltro,
} from '../api/ouvs-api';
import { AvanceZonaModal } from '../components/AvanceZonaModal';
import { InfluenciasSection } from '../components/InfluenciasSection';
import { InfluenciaNotaModal } from '../components/InfluenciaNotaModal';
import {
  CierreOuvModal,
  type OuvClosedEvent,
} from '../components/CierreOuvModal';
import { ContactoFormModal } from '../components/ContactoFormModal';
import { ContactosSidePanel } from '../components/ContactosSidePanel';
import { FloatingToast } from '../components/FloatingToast';
import {
  OuvDetailHeaderCard,
  type OuvHeaderDraft,
} from '../components/OuvDetailHeaderCard';
import { WonCelebration } from '../components/WonCelebration';
import { OuvFunnelRibbon } from '../components/OuvFunnelRibbon';
import {
  OuvDetailNav,
  type OuvDetailTab,
} from '../components/OuvDetailNav';
import { PreventaActivityPanel } from '../components/PreventaActivityPanel';
import { InteraccionesPreventaPanel } from '../components/InteraccionesPreventaPanel';
import { RetrocesoZonaModal } from '../components/RetrocesoZonaModal';
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';
import { backLinkForResultado } from '../lib/ouv-bandejas';
import {
  INFLUENCIA_TIPO_LABEL,
  isOuvNotificationEvent,
  type InfluenciaEstado,
  type InfluenciaTipo,
} from '../lib/ouv-vocab';
import {
  loadOuvExtensions,
  isRecurringDeProyecto,
  saveOuvExtensions,
  type OuvDetailExtensions,
} from '../lib/ouv-detail-extensions';

export function OuvDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();

  const [ouv, setOuv] = useState<Ouv | null>(null);
  const [contactos, setContactos] = useState<OuvContacto[]>([]);
  const [influencias, setInfluencias] = useState<OuvInfluencia[]>([]);
  const [filtro, setFiltro] = useState<OuvInfluenciaFiltro>(EMPTY_INFLUENCIA_FILTRO);
  const [savingInfluenciaId, setSavingInfluenciaId] = useState<string | null>(null);
  const [notaTarget, setNotaTarget] = useState<{
    tipo: InfluenciaTipo;
    contactoOuvId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPresupuesto, setSavingPresupuesto] = useState(false);
  const [contactoModal, setContactoModal] = useState<OuvContacto | null | 'new'>(
    null,
  );
  const [contactoModalContext, setContactoModalContext] =
    useState<InfluenciaTipo | null>(null);
  const [showContactos, setShowContactos] = useState(false);
  const [showAvance, setShowAvance] = useState(false);
  const [showRetroceso, setShowRetroceso] = useState(false);
  const [showCierre, setShowCierre] = useState(false);
  const [ouvEditMode, setOuvEditMode] = useState(false);
  const [detailTab, setDetailTab] = useState<OuvDetailTab>('detalle');
  const [ouvExtensions, setOuvExtensions] = useState<OuvDetailExtensions>({});
  const [closeToast, setCloseToast] = useState<string | null>(null);
  const [celebrateWin, setCelebrateWin] = useState(false);

  const [presupuestoConfirmado, setPresupuestoConfirmado] = useState(false);
  const [presupuestoMonto, setPresupuestoMonto] = useState('');
  const [presupuestoMoneda, setPresupuestoMoneda] = useState('COP');
  const [presupuestoFuente, setPresupuestoFuente] = useState('cliente_declaro');

  useEffect(() => {
    if (id) setOuvExtensions(loadOuvExtensions(id));
  }, [id]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!id) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const detail = await fetchOuv(id);
        setOuv(detail);
        setPresupuestoConfirmado(detail.presupuesto_confirmado);
        setPresupuestoMonto(formatAmountEsCo(detail.presupuesto_monto));
        setPresupuestoMoneda(detail.presupuesto_moneda ?? 'COP');
        setPresupuestoFuente(detail.presupuesto_fuente ?? 'cliente_declaro');

        const [c, i] = await Promise.all([
          fetchOuvContactos(id),
          fetchOuvInfluencias(id),
        ]);
        setContactos(c);
        setInfluencias(i.influencias);
        setFiltro(i.filtro);
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
    if (!closeToast) return;
    const timer = window.setTimeout(() => setCloseToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [closeToast]);

  async function refreshInfluencias() {
    if (!id) return;
    const list = await fetchOuvInfluencias(id);
    setInfluencias(list.influencias);
    setFiltro(list.filtro);
    const detail = await fetchOuv(id);
    setOuv(detail);
  }

  async function handleAddInfluencia(tipo: InfluenciaTipo, contactoOuvId: string) {
    if (!id) return;
    setActionError(null);
    try {
      await agregarInfluenciaContacto(id, tipo, contactoOuvId);
      await refreshInfluencias();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'No se pudo agregar el contacto.',
      );
    }
  }

  async function handleRateInfluencia(
    tipo: InfluenciaTipo,
    contactoOuvId: string,
    estado: InfluenciaEstado,
  ) {
    if (!id) return;
    const previous = influencias;
    const row = influencias.find(
      (item) => item.tipo === tipo && item.contacto_ouv_id === contactoOuvId,
    );
    if (!row) return;
    setInfluencias((current) =>
      current.map((item) =>
        item.influencia_id === row.influencia_id ? { ...item, estado } : item,
      ),
    );
    setSavingInfluenciaId(row.influencia_id);
    setActionError(null);
    try {
      await calificarInfluenciaContacto(id, tipo, contactoOuvId, estado);
      await refreshInfluencias();
    } catch (err) {
      setInfluencias(previous);
      setActionError(
        err instanceof ApiError ? err.message : 'No se pudo guardar la calificación.',
      );
    } finally {
      setSavingInfluenciaId(null);
    }
  }

  async function handleRemoveInfluencia(
    tipo: InfluenciaTipo,
    contactoOuvId: string,
  ) {
    if (!id) return;
    setActionError(null);
    try {
      await quitarInfluenciaContacto(id, tipo, contactoOuvId);
      await refreshInfluencias();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'No se pudo quitar el contacto.',
      );
    }
  }

  async function handleSaveNota(notas: string) {
    if (!id || !notaTarget) return;
    setSavingInfluenciaId(notaTarget.contactoOuvId);
    setActionError(null);
    try {
      await editarNotaInfluenciaContacto(
        id,
        notaTarget.tipo,
        notaTarget.contactoOuvId,
        notas || null,
      );
      setNotaTarget(null);
      await refreshInfluencias();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'No se pudo guardar la nota.',
      );
    } finally {
      setSavingInfluenciaId(null);
    }
  }

  async function handleSaveContacto(
    payload: ContactoPayload,
    meta?: { influenciaTipo?: InfluenciaTipo | null },
  ) {
    if (!id) return;
    let createdId: string | null = null;
    if (contactoModal && contactoModal !== 'new') {
      await updateOuvContacto(id, contactoModal.contacto_ouv_id, payload);
    } else {
      const created = await createOuvContacto(id, payload);
      createdId = created.contacto_ouv_id;
    }
    await load({ silent: true });
    const assignTipo = meta?.influenciaTipo ?? contactoModalContext;
    if (createdId && assignTipo) {
      await handleAddInfluencia(assignTipo, createdId);
    }
    setContactoModal(null);
    setContactoModalContext(null);
  }

  function openContactoModal(
    mode: OuvContacto | 'new',
    influenciaTipo?: InfluenciaTipo,
  ) {
    setContactoModal(mode);
    setContactoModalContext(influenciaTipo ?? null);
  }

  function closeContactoModal() {
    setContactoModal(null);
    setContactoModalContext(null);
  }

  async function handleDeleteContacto(contacto: OuvContacto) {
    if (!id) return;
    const confirmed = window.confirm(
      `¿Eliminar el contacto ${contacto.name}? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteOuvContacto(id, contacto.contacto_ouv_id);
      await load({ silent: true });
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo eliminar el contacto.',
      );
    }
  }

  async function handleSavePresupuesto() {
    if (!id) return;
    setActionError(null);
    setActionSuccess(null);
    setSavingPresupuesto(true);
    try {
      const parsedMonto = parseAmountInputEsCo(presupuestoMonto);
      if (presupuestoMonto.trim() && parsedMonto === null) {
        throw new Error('El monto debe ser un número válido.');
      }
      await updateOuvPresupuesto(id, {
        presupuesto_confirmado: presupuestoConfirmado,
        presupuesto_monto: parsedMonto,
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

  async function persistOuvHeader(draft: OuvHeaderDraft) {
    if (!id) return;
    setActionError(null);
    try {
      await updateOuv(id, {
        titulo: draft.titulo.trim(),
        empresa_nombre: draft.empresa_nombre.trim(),
        segmento: draft.segmento,
        vertical: draft.vertical,
        descripcion: draft.descripcion.trim(),
        city: draft.city.trim() || null,
        region: draft.region.trim() || null,
        is_recurring: isRecurringDeProyecto(draft.extensions.proyecto),
      });
      saveOuvExtensions(id, draft.extensions);
      setOuvExtensions(draft.extensions);
      setOuv((prev) =>
        prev
          ? {
              ...prev,
              titulo: draft.titulo.trim(),
              empresa_nombre: draft.empresa_nombre.trim(),
              segmento: draft.segmento as Ouv['segmento'],
              vertical: draft.vertical,
              descripcion: draft.descripcion.trim() || null,
              city: draft.city.trim() || null,
              region: draft.region.trim() || null,
              is_recurring: isRecurringDeProyecto(draft.extensions.proyecto),
              updated_at: new Date().toISOString(),
            }
          : prev,
      );
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'No se pudo guardar la OUV.',
      );
      throw err;
    }
  }

  function handleOuvClosed({ resultado, ouv: updated }: OuvClosedEvent) {
    setOuv((prev) =>
      prev
        ? {
            ...prev,
            ...updated,
            dias_por_zona: updated.dias_por_zona ?? prev.dias_por_zona,
          }
        : updated,
    );
    setShowCierre(false);
    setActionError(null);
    const message =
      resultado === 'Ganada'
        ? 'La OUV se cerró correctamente como Ganada.'
        : resultado === 'Perdida'
          ? 'La OUV se cerró como Perdida. Queda disponible en Oportunidades perdidas.'
          : `La OUV se cerró correctamente como ${resultado}.`;
    setCloseToast(message);
    setActionSuccess(message);
    setCelebrateWin(resultado === 'Ganada');
    void load({ silent: true });
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
          Volver a Bandeja OUV
        </Link>
      </AppLayout>
    );
  }

  const editable =
    ouv.resultado === 'EnCurso' && user?.user_id === ouv.comercial_id;
  // Mismo guard CASL que `POST solicitudes-preventa`: sin `update Opportunity`
  // (Preventa y otros roles de seguimiento) el panel queda en solo lectura.
  const canSolicitarPreventa = Boolean(
    user?.permissions?.some(
      (p) => p.action === 'update' && p.subject === 'Opportunity',
    ),
  );
  // Misma regla que `OuvInteraccionesService.lockOuvForWrite`: `update
  // Opportunity`, OUV en curso y ser dueño, Admin o SoporteComercial.
  const canEscribirInteracciones =
    canSolicitarPreventa &&
    ouv.resultado === 'EnCurso' &&
    (user?.user_id === ouv.comercial_id ||
      user?.role_name === 'Admin' ||
      user?.role_name === 'SoporteComercial');
  const backLink = backLinkForResultado(ouv.resultado);
  const influenciaByContacto = new Map<string, string[]>();
  for (const inf of influencias) {
    if (!inf.contacto_ouv_id) continue;
    const label =
      INFLUENCIA_TIPO_LABEL[inf.tipo as InfluenciaTipo] ?? inf.tipo;
    const list = influenciaByContacto.get(inf.contacto_ouv_id) ?? [];
    list.push(label);
    influenciaByContacto.set(inf.contacto_ouv_id, list);
  }

  return (
    <AppLayout title={ouv.consecutivo}>
      <div className="mb-4">
        <Link to={backLink.to} className="text-sm text-accent hover:underline">
          {backLink.label}
        </Link>
      </div>
      <OuvFunnelRibbon ouv={ouv} />
      <OuvDetailNav active={detailTab} onChange={setDetailTab} />

      {detailTab === 'detalle' ? (
        <>
          <OuvDetailHeaderCard
            ouv={ouv}
            extensions={ouvExtensions}
            editable={editable}
            editMode={ouvEditMode}
            onToggleEditMode={() => setOuvEditMode((v) => !v)}
            onAvanzar={() => setShowAvance(true)}
            onRetroceder={() => setShowRetroceso(true)}
            onCerrar={() => setShowCierre(true)}
            onPersist={persistOuvHeader}
            contactosCount={contactos.length}
            onOpenContactos={() => setShowContactos(true)}
          />
        </>
      ) : null}

      {detailTab === 'detalle' && !editable ? (
        <p className="mb-3 rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          Solo lectura: las influencias y el presupuesto las edita el comercial
          dueño de la OUV (o un Admin).
        </p>
      ) : null}

      {detailTab === 'preventa' ? (
        <PreventaActivityPanel
          ouv={ouv}
          commercialOwnerName={user?.full_name}
          readOnly={!canSolicitarPreventa}
        />
      ) : detailTab === 'interacciones' ? (
        <InteraccionesPreventaPanel
          ouv={ouv}
          readOnly={!canEscribirInteracciones}
        />
      ) : (
        <>
      {ouv.tiene_gap ? (
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

      {/* Influencias — primary workspace */}
      <InfluenciasSection
        influencias={influencias}
        filtro={filtro}
        contactos={contactos}
        editable={editable}
        savingId={savingInfluenciaId}
        onAddExisting={(tipo, contactoOuvId) =>
          void handleAddInfluencia(tipo, contactoOuvId)
        }
        onCreateContact={(tipo) => openContactoModal('new', tipo)}
        onRate={(tipo, contactoOuvId, estado) =>
          void handleRateInfluencia(tipo, contactoOuvId, estado)
        }
        onRemove={(tipo, contactoOuvId) =>
          void handleRemoveInfluencia(tipo, contactoOuvId)
        }
        onOpenNota={(tipo, contactoOuvId) =>
          setNotaTarget({ tipo, contactoOuvId })
        }
      />

      {/* Presupuesto */}
      <section className={`${cardClass} mb-4 p-4`}>
        <h2 className="mb-1 text-sm font-bold text-ink">Presupuesto</h2>
        <p className="mb-3 text-xs text-muted">
          No se guarda solo: edita los campos y pulsa{' '}
          <strong>Guardar presupuesto</strong>. Marca &quot;Confirmado&quot;
          para poder avanzar a Encima Funnel.
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex items-center gap-2 text-sm text-ink">
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
          <div>
            <label className={labelClass}>Monto</label>
            <input
              className={inputClass}
              value={presupuestoMonto}
              disabled={!editable}
              inputMode="decimal"
              autoComplete="off"
              onChange={(e) => {
                setPresupuestoMonto(formatAmountInputEsCo(e.target.value));
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
              <option value="cliente_declaro">Cliente declaró</option>
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

      {/* Cierre */}
      {ouv.resultado !== 'EnCurso' ? (
        <section className={`${cardClass} mb-4 p-4`}>
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
              <dt className="text-muted">
                {ouv.resultado === 'Ganada' ? 'Tipo de proceso' : 'Motivo'}
              </dt>
              <dd className="text-ink">{ouv.motivo_snapshot ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">Monto</dt>
              <dd className="text-ink">
                {ouv.monto_final
                  ? `${formatAmountEsCo(ouv.monto_final)} ${ouv.moneda_final ?? ''}`.trim()
                  : ouv.monto_estimado_perdido
                    ? `${formatAmountEsCo(ouv.monto_estimado_perdido)} (estimado)`
                    : '—'}
              </dd>
            </div>
            {ouv.competidor_ganador ? (
              <div>
                <dt className="text-muted">Competidor</dt>
                <dd className="text-ink">{ouv.competidor_ganador}</dd>
              </div>
            ) : null}
            {ouv.motivo_detalle ? (
              <div className="md:col-span-2">
                <dt className="text-muted">Observación</dt>
                <dd className="text-ink">{ouv.motivo_detalle}</dd>
              </div>
            ) : null}
          </dl>
          {ouv.resultado === 'Perdida' ? (
            <p className="mt-3 text-sm">
              <Link
                to="/opportunities/perdidas"
                className="font-bold text-accent hover:underline"
              >
                Ver bandeja de oportunidades perdidas
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
        </>
      )}

      {notaTarget ? (
        <InfluenciaNotaModal
          nombre={
            contactos.find((c) => c.contacto_ouv_id === notaTarget.contactoOuvId)
              ?.name ?? 'Contacto'
          }
          tipoLabel={INFLUENCIA_TIPO_LABEL[notaTarget.tipo]}
          consecutivo={ouv.consecutivo}
          initialNotas={
            influencias.find(
              (row) =>
                row.tipo === notaTarget.tipo &&
                row.contacto_ouv_id === notaTarget.contactoOuvId,
            )?.notas ?? ''
          }
          saving={savingInfluenciaId === notaTarget.contactoOuvId}
          onClose={() => setNotaTarget(null)}
          onSave={(notas) => void handleSaveNota(notas)}
        />
      ) : null}
      {contactoModal ? (
        <ContactoFormModal
          initial={contactoModal === 'new' ? null : contactoModal}
          lockAccountId={ouv.account_id}
          influenciaTipo={contactoModalContext}
          onClose={closeContactoModal}
          onSave={handleSaveContacto}
        />
      ) : null}
      <ContactosSidePanel
        open={showContactos}
        contactos={contactos}
        influenciaByContacto={influenciaByContacto}
        editable={editable}
        onClose={() => setShowContactos(false)}
        onAdd={() => openContactoModal('new')}
        onEdit={(contacto) => openContactoModal(contacto)}
        onDelete={(contacto) => void handleDeleteContacto(contacto)}
      />
      {showAvance ? (
        <AvanceZonaModal
          ouv={ouv}
          filtro={filtro}
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
          onClosed={handleOuvClosed}
        />
      ) : null}
      {closeToast ? (
        <FloatingToast
          message={closeToast}
          tone="success"
          onDismiss={() => setCloseToast(null)}
        />
      ) : null}
      {celebrateWin ? (
        <WonCelebration onDone={() => setCelebrateWin(false)} />
      ) : null}
    </AppLayout>
  );
}

export default OuvDetailPage;
