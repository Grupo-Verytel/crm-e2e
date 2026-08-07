import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  updateOuvContacto,
  updateOuvInfluencia,
  updateOuvPresupuesto,
  type ContactoPayload,
  type Ouv,
  type OuvChecklistItem,
  type OuvContacto,
  type OuvInfluencia,
} from '../api/ouvs-api';
import { AvanceZonaModal } from '../components/AvanceZonaModal';
import { CierreOuvModal } from '../components/CierreOuvModal';
import { ContactoFormModal } from '../components/ContactoFormModal';
import { DiscoveryNav } from '../components/DiscoveryNav';
import { GapBadge, ResultadoBadge, ZonaBadge } from '../components/OuvBadges';
import { RetrocesoZonaModal } from '../components/RetrocesoZonaModal';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';
import {
  INFLUENCIA_ESTADOS,
  INFLUENCIA_TIPOS,
  isOuvNotificationEvent,
  type InfluenciaTipo,
} from '../lib/ouv-vocab';

export function OuvDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();

  const [ouv, setOuv] = useState<Ouv | null>(null);
  const [contactos, setContactos] = useState<OuvContacto[]>([]);
  const [influencias, setInfluencias] = useState<OuvInfluencia[]>([]);
  const [checklist, setChecklist] = useState<OuvChecklistItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactoModal, setContactoModal] = useState<OuvContacto | null | 'new'>(
    null,
  );
  const [showAvance, setShowAvance] = useState(false);
  const [showRetroceso, setShowRetroceso] = useState(false);
  const [showCierre, setShowCierre] = useState(false);

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

  async function handleSaveContacto(payload: ContactoPayload) {
    if (!id) return;
    if (contactoModal && contactoModal !== 'new') {
      await updateOuvContacto(id, contactoModal.contacto_ouv_id, payload);
    } else {
      await createOuvContacto(id, payload);
    }
    await load({ silent: true });
  }

  async function handleDeleteContacto(contacto: OuvContacto) {
    if (!id) return;
    if (!window.confirm(`¿Eliminar contacto ${contacto.nombre}?`)) return;
    try {
      await deleteOuvContacto(id, contacto.contacto_ouv_id);
      await load({ silent: true });
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'No se pudo eliminar.',
      );
    }
  }

  async function handleInfluenciaChange(
    tipo: InfluenciaTipo,
    patch: Partial<OuvInfluencia> & { estado: string },
  ) {
    if (!id) return;
    setActionError(null);
    try {
      await updateOuvInfluencia(id, tipo, {
        estado: patch.estado,
        contacto_ouv_id: patch.contacto_ouv_id,
        motivo_estado: patch.motivo_estado,
        notas: patch.notas,
      });
      await load({ silent: true });
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo actualizar la influencia.',
      );
    }
  }

  async function handleSavePresupuesto() {
    if (!id) return;
    setActionError(null);
    try {
      await updateOuvPresupuesto(id, {
        presupuesto_confirmado: presupuestoConfirmado,
        presupuesto_monto: presupuestoMonto
          ? Number(presupuestoMonto)
          : null,
        presupuesto_moneda: presupuestoMoneda,
        presupuesto_fuente: presupuestoFuente,
        presupuesto_fecha_captura: new Date().toISOString(),
      });
      await load({ silent: true });
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo guardar el presupuesto.',
      );
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
        <Link to="/opportunities" className="mt-3 inline-block text-brand">
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
      <DiscoveryNav />
      <div className="mb-4">
        <Link to="/opportunities" className="text-sm text-brand hover:underline">
          ← Bandeja OUV
        </Link>
      </div>

      {isSoporte && !editable ? (
        <p className="mb-3 rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          Vista Soporte: lectura de OUV. La edición de zona/cierre es del
          comercial dueño. Catálogos en el menú superior.
        </p>
      ) : null}

      <header className={`${cardClass} mb-4 p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-muted">{ouv.consecutivo}</p>
            <h1 className="text-xl font-bold text-ink">{ouv.titulo}</h1>
            <p className="text-sm text-ink">{ouv.empresa_nombre}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ZonaBadge zona={ouv.zona_actual} />
              <ResultadoBadge resultado={ouv.resultado} />
              <span className="rounded bg-bg px-2 py-0.5 text-xs font-bold text-ink">
                {ouv.origen_via === 'directa' ? 'Directa' : 'Desde SQL'}
              </span>
              {ouv.tiene_gap ? <GapBadge /> : null}
            </div>
          </div>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => setShowAvance(true)}
              >
                Avanzar zona
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => setShowRetroceso(true)}
              >
                Retroceder
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => setShowCierre(true)}
              >
                Cerrar OUV
              </button>
            </div>
          ) : null}
        </div>
        {ouv.descripcion ? (
          <p className="mt-3 text-sm text-muted">{ouv.descripcion}</p>
        ) : null}
      </header>

      {ouv.tiene_gap ? (
        <div className="mb-4 rounded border border-warning bg-warning/15 p-3 text-sm text-ink">
          Esta OUV tiene gap de criterios:{' '}
          {(ouv.criterios_faltantes ?? []).join(', ') || 'revisar zona actual'}.
        </div>
      ) : null}

      {actionError ? (
        <p className="mb-3 text-sm text-danger">{actionError}</p>
      ) : null}

      {/* Contactos */}
      <section className={`${cardClass} mb-4 p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Contactos</h2>
          {editable ? (
            <button
              type="button"
              className={ghostButtonClass}
              onClick={() => setContactoModal('new')}
            >
              Agregar
            </button>
          ) : null}
        </div>
        {contactos.length === 0 ? (
          <p className="text-sm text-muted">Sin contactos.</p>
        ) : (
          <ul className="divide-y divide-border">
            {contactos.map((c) => (
              <li
                key={c.contacto_ouv_id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <p className="text-sm font-bold text-ink">{c.nombre}</p>
                  <p className="text-xs text-muted">
                    {[c.cargo, c.email, c.telefono].filter(Boolean).join(' · ') ||
                      '—'}
                  </p>
                  {contactoInfluenciaMap.has(c.contacto_ouv_id) ? (
                    <p className="mt-1 text-xs text-brand">
                      Influencia:{' '}
                      {contactoInfluenciaMap.get(c.contacto_ouv_id)!.join(', ')}
                    </p>
                  ) : null}
                </div>
                {editable ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={ghostButtonClass}
                      onClick={() => setContactoModal(c)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={ghostButtonClass}
                      onClick={() => void handleDeleteContacto(c)}
                    >
                      Eliminar
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Influencias */}
      <section className={`${cardClass} mb-4 p-4`}>
        <h2 className="mb-3 text-sm font-bold text-ink">Influencias</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {INFLUENCIA_TIPOS.map((tipo) => {
            const inf = influencias.find((x) => x.tipo === tipo);
            return (
              <div
                key={tipo}
                className="rounded border border-border bg-bg p-3"
              >
                <p className="mb-2 text-sm font-bold text-ink">{tipo}</p>
                <label className={labelClass}>Estado</label>
                <select
                  className={inputClass}
                  disabled={!editable}
                  value={inf?.estado ?? 'SinEvaluar'}
                  onChange={(e) =>
                    void handleInfluenciaChange(tipo, {
                      estado: e.target.value,
                      contacto_ouv_id: inf?.contacto_ouv_id ?? null,
                      notas: inf?.notas,
                      motivo_estado: inf?.motivo_estado,
                    })
                  }
                >
                  {INFLUENCIA_ESTADOS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <label className={`${labelClass} mt-2`}>Contacto</label>
                <select
                  className={inputClass}
                  disabled={!editable}
                  value={inf?.contacto_ouv_id ?? ''}
                  onChange={(e) =>
                    void handleInfluenciaChange(tipo, {
                      estado: inf?.estado ?? 'SinEvaluar',
                      contacto_ouv_id: e.target.value || null,
                      notas: inf?.notas,
                      motivo_estado: inf?.motivo_estado,
                    })
                  }
                >
                  <option value="">Sin asignar</option>
                  {contactos.map((c) => (
                    <option key={c.contacto_ouv_id} value={c.contacto_ouv_id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <label className={`${labelClass} mt-2`}>Notas</label>
                <textarea
                  className={`${inputClass} h-16 py-2`}
                  disabled={!editable}
                  defaultValue={inf?.notas ?? ''}
                  onBlur={(e) => {
                    if (!editable || !inf) return;
                    if ((inf.notas ?? '') === e.target.value) return;
                    void handleInfluenciaChange(tipo, {
                      estado: inf.estado,
                      contacto_ouv_id: inf.contacto_ouv_id,
                      notas: e.target.value || null,
                      motivo_estado: inf.motivo_estado,
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Presupuesto */}
      <section className={`${cardClass} mb-4 p-4`}>
        <h2 className="mb-3 text-sm font-bold text-ink">Presupuesto</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={presupuestoConfirmado}
              disabled={!editable}
              onChange={(e) => setPresupuestoConfirmado(e.target.checked)}
            />
            Confirmado
          </label>
          <div>
            <label className={labelClass}>Monto</label>
            <input
              className={inputClass}
              value={presupuestoMonto}
              disabled={!editable}
              onChange={(e) => setPresupuestoMonto(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Moneda</label>
            <select
              className={inputClass}
              value={presupuestoMoneda}
              disabled={!editable}
              onChange={(e) => setPresupuestoMoneda(e.target.value)}
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
              onChange={(e) => setPresupuestoFuente(e.target.value)}
            >
              <option value="cliente_declaro">Cliente declaró</option>
              <option value="contrato_previo">Contrato previo</option>
              <option value="licitacion_publicada">Licitación</option>
              <option value="estimacion_comercial">Estimación</option>
              <option value="sin_verificar">Sin verificar</option>
            </select>
          </div>
        </div>
        {editable ? (
          <button
            type="button"
            className={`${primaryButtonClass} mt-3`}
            onClick={() => void handleSavePresupuesto()}
          >
            Guardar presupuesto
          </button>
        ) : null}
      </section>

      {/* Checklist */}
      <section className={`${cardClass} mb-4 p-4`}>
        <h2 className="mb-3 text-sm font-bold text-ink">
          Checklist — zona actual
        </h2>
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

      {contactoModal ? (
        <ContactoFormModal
          initial={contactoModal === 'new' ? null : contactoModal}
          onClose={() => setContactoModal(null)}
          onSave={handleSaveContacto}
        />
      ) : null}
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
    </AppLayout>
  );
}

export default OuvDetailPage;
