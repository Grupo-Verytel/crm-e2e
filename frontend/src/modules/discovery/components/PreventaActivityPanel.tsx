import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../auth/types';
import { SharePointPreviewModal } from '../../offer-closing/components/SharePointPreviewModal';
import type { Ouv } from '../api/ouvs-api';
import {
  fetchSolicitudesPreventa,
  type SolicitudNarrativa,
  type SolicitudPreventa,
  type SolicitudServicio,
} from '../api/solicitudes-preventa-api';
import {
  SOLICITUD_PREVENTA_FIELDS,
  SERVICE_LABELS,
} from '../lib/opportunity-context-fields';
import type {
  BusinessMilestone,
  ProcessingStatus,
} from '../lib/preventa-vocab';
import {
  labelResponseStatus,
  labelViabilidadPreventa,
} from '../lib/preventa-vocab';
import {
  deliverableDisplayName,
  type DeliverableDisplayInput,
} from '../lib/sharepoint-document';
import {
  derivarEstadoServicio,
  derivarMepStatus,
  type MepSolicitudStatus,
} from '../lib/solicitud-preventa-rules';
import { FloatingToast } from './FloatingToast';
import { ModalShell } from './ModalShell';
import { SolicitudPreventaModal } from './SolicitudPreventaModal';
import { badgeClass, cardClass, ghostButtonClass, labelClass } from './ui';

type Props = {
  ouv: Ouv;
  commercialOwnerName?: string;
  /** Sin `update Opportunity`: se listan las solicitudes pero no se crean. */
  readOnly?: boolean;
};

export type { MepSolicitudStatus };

const MEP_STATUS_CLASS: Record<MepSolicitudStatus, string> = {
  Aceptado: 'bg-accent text-white',
  'En progreso': 'bg-brand text-white',
  'Parcialmente completo': 'bg-mep-partial text-ink',
  Completado: 'bg-success text-white',
  Cancelado: 'bg-border text-muted',
  Rechazado: 'bg-danger text-white',
  Pendiente: 'bg-border text-muted',
};

function MepStatusBadge({ status }: { status: MepSolicitudStatus }) {
  return (
    <span className={`${badgeClass} ${MEP_STATUS_CLASS[status]}`}>
      {status}
    </span>
  );
}

/** Nombre del combo a partir de los servicios que devolvió el backend. */
function nombreDelTipo(solicitud: SolicitudPreventa): string {
  const servicios = solicitud.requested_services;
  const tieneTecnica = servicios.some((s) => s.service === 'TECHNICAL_DESIGN');
  const tieneFinanciera = servicios.some(
    (s) => s.service === 'FINANCIAL_DESIGN',
  );
  const dependiente = servicios.some((s) => s.dependency !== 'NONE');

  if (tieneTecnica && tieneFinanciera) {
    return dependiente ? 'Técnico y luego financiero' : 'Técnico y financiero';
  }
  return tieneTecnica ? 'Técnica' : 'Financiera';
}

/** Los dos servicios van en el mismo contenedor cuando son independientes. */
function esMismoContenedor(solicitud: SolicitudPreventa): boolean {
  return (
    solicitud.requested_services.length > 1 &&
    solicitud.requested_services.every((s) => s.dependency === 'NONE')
  );
}

type ServiceCardView = {
  service: string;
  label: string;
  dependency: string;
  state: 'active' | 'blocked';
};

/**
 * Tarjetas de servicio. Cuando MEP ya respondió, el bloqueo sale de
 * `bloqueado_por_dependencia`; antes, de la dependencia declarada (caso C-4).
 */
function tarjetasDeServicio(solicitud: SolicitudPreventa): ServiceCardView[] {
  const resultados = new Map<string, SolicitudServicio>(
    solicitud.servicios.map((s) => [s.service, s]),
  );

  return solicitud.requested_services.map((solicitado) => {
    const resultado = resultados.get(solicitado.service);
    const bloqueado = resultado
      ? resultado.bloqueado_por_dependencia
      : solicitado.dependency !== 'NONE';

    return {
      service: solicitado.service,
      label: SERVICE_LABELS[solicitado.service] ?? solicitado.service,
      dependency: solicitado.dependency,
      state: bloqueado ? 'blocked' : 'active',
    };
  });
}

/** Valores que muestra el modal de detalle, con los campos del contrato. */
function valoresDeSolicitud(
  solicitud: SolicitudPreventa,
): Record<string, string> {
  return {
    crm_interaction_ref: solicitud.crm_interaction_ref,
    crm_opportunity_ref: solicitud.crm_opportunity_ref ?? '',
    activity_type:
      solicitud.service_horizon === 'IMMEDIATE'
        ? 'interaccion_asap'
        : 'interaccion_sombra',
    service_horizon: solicitud.service_horizon,
    subject: solicitud.subject ?? '',
    source_content: solicitud.source_content,
    source_created_at: solicitud.source_created_at ?? '',
    source_version: solicitud.source_version,
    etag: solicitud.etag,
  };
}

function formatFieldValue(key: string, value: string): string {
  if (!value) {
    return '—';
  }
  if (key === 'source_created_at') {
    return formatDateTimeValue(value);
  }
  return value;
}

function formatDateTimeValue(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('es-CO');
}

function formatFechaEntrega(etaDate: string | null): string {
  if (!etaDate) {
    return '—';
  }
  const parsed = new Date(
    etaDate.includes('T') ? etaDate : `${etaDate}T00:00:00`,
  );
  return Number.isNaN(parsed.getTime())
    ? etaDate
    : parsed.toLocaleDateString('es-CO');
}

/**
 * Link que Preventa publicó para el servicio; si aún no hay respuesta, el de
 * otro servicio o el adjunto de creación. Un servicio bloqueado solo muestra
 * su propio entregable.
 */
function entregableSharePoint(
  solicitud: SolicitudPreventa,
  service: ServiceCardView,
  resultado: SolicitudServicio | undefined,
): DeliverableDisplayInput | null {
  const delServicio = resultado?.entregables[0];
  if (delServicio?.url) {
    return delServicio;
  }
  if (service.state === 'blocked') {
    return null;
  }
  for (const servicio of solicitud.servicios) {
    const entregable = servicio.entregables[0];
    if (entregable?.url) {
      return entregable;
    }
  }
  const crmUrl = solicitud.sharepoint_document_url;
  if (crmUrl) {
    return { url: crmUrl, label: null };
  }
  return null;
}

type DetailTab = 'informacion' | 'historico';

const detailTabClass = (active: boolean) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    active
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

const fieldValueClass =
  'min-h-9 rounded border border-border bg-bg px-3 py-2 text-sm text-ink';

/** `etag` es control de concurrencia del contrato; no es dato comercial. */
const DETAIL_INFO_FIELDS = SOLICITUD_PREVENTA_FIELDS.filter(
  (field) => field.key !== 'etag',
);

const MILESTONE_ACCION: Record<BusinessMilestone, string> = {
  INTERACTION_RECEIVED: 'Recepción de la solicitud',
  ENGINEER_ASSIGNED: 'Asignación de ingeniero',
  ROUTE_CAPACITY_REGISTERED: 'Evaluación de ruta y capacidad',
  INTERACTION_COMPLETED: 'Entrega de diseño y cierre',
};

const PROCESSING_STATUS_LABEL: Record<ProcessingStatus, string> = {
  ACCEPTED: 'Aceptado',
  DUPLICATE: 'Duplicado',
  QUARANTINED: 'En cuarentena',
  REJECTED: 'Rechazado',
};

function narrativaMessage(entrada: SolicitudNarrativa): string {
  return (
    entrada.narrative_note?.trim() ||
    MILESTONE_ACCION[entrada.business_milestone] ||
    entrada.business_milestone
  );
}

/** Resumen del servicio; si no hay, la nota de la versión más reciente. */
function resolveObservaciones(
  solicitud: SolicitudPreventa,
  resultado: SolicitudServicio | undefined,
): string {
  const summary = resultado?.summary?.trim();
  if (summary) return summary;
  const ultima = solicitud.narrativa.find((e) => e.narrative_note?.trim());
  return ultima?.narrative_note?.trim() || 'Sin observaciones.';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-bold text-ink">{label}: </span>
      <span className="text-ink">{value}</span>
    </p>
  );
}

function ServiceCard({
  card,
  serviceStatus,
  onOpen,
}: {
  card: ServiceCardView;
  serviceStatus: MepSolicitudStatus;
  onOpen: () => void;
}) {
  const active = card.state === 'active';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        'w-full rounded border p-3 text-left transition-colors',
        active
          ? 'border-accent/50 bg-accent/10 hover:border-accent'
          : 'border-border bg-bg opacity-55 hover:opacity-80',
      ].join(' ')}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span
          className={[
            badgeClass,
            active ? 'bg-accent text-white' : 'bg-border text-muted',
          ].join(' ')}
        >
          {card.label}
        </span>
        <MepStatusBadge status={serviceStatus} />
        {active ? (
          <span className="text-xs font-bold text-accent">Activa</span>
        ) : (
          <span className="text-xs font-bold text-muted">Bloqueada</span>
        )}
      </div>
      <p className="text-xs text-muted">
        {card.service}
        {card.dependency !== 'NONE' ? ` · depende de ${card.dependency}` : ''}
      </p>
      {!active ? (
        <p className="mt-2 text-xs text-muted">
          Disponible cuando Preventa retorne el documento de viabilidad técnica.
        </p>
      ) : null}
    </button>
  );
}

function SolicitudDetailModal({
  solicitud,
  service,
  onClose,
}: {
  solicitud: SolicitudPreventa;
  service: ServiceCardView;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('informacion');
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(
    null,
  );
  const [pistaOpen, setPistaOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const values = valoresDeSolicitud(solicitud);
  const resultado = solicitud.servicios.find(
    (s) => s.service === service.service,
  );
  const documentoPrincipal = entregableSharePoint(
    solicitud,
    service,
    resultado,
  );
  const entregablesExtra = (resultado?.entregables ?? []).slice(1);
  const tipoNombre = nombreDelTipo(solicitud);
  // Narrativa MEP: más reciente primero (T-302).
  const history = solicitud.narrativa;

  return (
    <>
      <ModalShell
        title={`Detalle — ${service.label}`}
        onClose={onClose}
        size="wide"
        headerAside={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={[
                badgeClass,
                service.state === 'active'
                  ? 'bg-accent text-white'
                  : 'bg-border text-muted',
              ].join(' ')}
            >
              {service.label}
            </span>
            {tipoNombre !== service.label ? (
              <span className={`${badgeClass} bg-border text-ink`}>
                {tipoNombre}
              </span>
            ) : null}
            <span className={`${badgeClass} bg-accent/15 text-accent`}>
              {solicitud.service_horizon === 'IMMEDIATE' ? 'ASAP' : 'Sombra'}
            </span>
            {service.state === 'blocked' ? (
              <span className={`${badgeClass} bg-border text-muted`}>
                Bloqueada
              </span>
            ) : null}
            <MepStatusBadge status={derivarEstadoServicio(resultado)} />
          </div>
        }
      >
        <nav
          className="sticky top-0 z-10 mb-4 flex flex-wrap gap-1 border-b border-border bg-surface"
          aria-label="Detalle de solicitud"
        >
          <button
            type="button"
            className={detailTabClass(tab === 'informacion')}
            onClick={() => setTab('informacion')}
            aria-current={tab === 'informacion' ? 'page' : undefined}
          >
            Información solicitud
          </button>
          <button
            type="button"
            className={detailTabClass(tab === 'historico')}
            onClick={() => setTab('historico')}
            aria-current={tab === 'historico' ? 'page' : undefined}
          >
            Histórico
          </button>
        </nav>

        {tab === 'informacion' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {DETAIL_INFO_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className={field.spanFull ? 'sm:col-span-2' : undefined}
                >
                  <p className={labelClass}>{field.label}</p>
                  <p
                    className={[
                      fieldValueClass,
                      'whitespace-pre-wrap',
                      field.inputType === 'textarea' ? 'min-h-20' : '',
                    ].join(' ')}
                  >
                    {formatFieldValue(field.key, values[field.key] ?? '')}
                  </p>
                </div>
              ))}
              <div>
                <p className={labelClass}>Fecha de entrega</p>
                <p className={fieldValueClass}>
                  {formatFechaEntrega(solicitud.estado.eta_date)}
                </p>
              </div>
              <div>
                <p className={labelClass}>Preventa asignado</p>
                <p className={fieldValueClass}>
                  {solicitud.asignacion?.engineer.display_name ?? 'Sin asignar'}
                </p>
              </div>
              <div>
                <p className={labelClass}>Viabilidad</p>
                <p className={fieldValueClass}>
                  {labelViabilidadPreventa({
                    service: service.service,
                    outcome: resultado?.outcome ?? null,
                    status: resultado?.status ?? null,
                    entregablesCount: resultado?.entregables.length ?? 0,
                    routeStatus: solicitud.ruta_capacidad?.route_status ?? null,
                  })}
                </p>
              </div>
              <div>
                <p className={labelClass}>Documento</p>
                {documentoPrincipal ? (
                  <button
                    type="button"
                    className="inline-flex min-h-9 w-full max-w-full items-center gap-2 rounded border border-border bg-bg px-3 py-2 text-left text-sm font-bold text-accent hover:underline"
                    onClick={() =>
                      setPreview({
                        title: deliverableDisplayName(documentoPrincipal),
                        url: documentoPrincipal.url,
                      })
                    }
                  >
                    <ExternalLink size={15} aria-hidden />
                    <span className="truncate text-accent">
                      {deliverableDisplayName(documentoPrincipal)}
                    </span>
                  </button>
                ) : (
                  <p className={`${fieldValueClass} text-muted`}>
                    Sin documento vinculado
                  </p>
                )}
                {/* Entregables: SharePoint Documents; el registro de ruta no lo es. */}
                {entregablesExtra.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {entregablesExtra.map((entregable) => (
                      <li key={entregable.url}>
                        <button
                          type="button"
                          className="text-xs font-bold text-accent hover:underline"
                          onClick={() =>
                            setPreview({
                              title: deliverableDisplayName(entregable),
                              url: entregable.url,
                            })
                          }
                        >
                          {deliverableDisplayName(entregable)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded border border-border bg-bg p-3">
              <p className={labelClass}>Observaciones</p>
              <p className="min-h-20 whitespace-pre-wrap text-sm text-ink">
                {resolveObservaciones(solicitud, resultado)}
              </p>
            </div>
          </>
        ) : (
          <div>
            <p className="mb-3 text-xs font-bold text-muted">
              Historial de Preventa
            </p>
            {history.length === 0 ? (
              <p className="rounded border border-dashed border-border bg-bg px-3 py-6 text-center text-sm text-muted">
                MEP-LEAN aún no ha respondido esta solicitud.
              </p>
            ) : (
              <ul className="space-y-2">
                {history.map((entrada) => {
                  const selected = entrada.response_version === selectedVersion;
                  return (
                    <li key={entrada.response_version}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedVersion(
                            selected ? null : entrada.response_version,
                          )
                        }
                        className={[
                          'w-full rounded border-l-2 px-3 py-2 text-left transition-colors',
                          selected
                            ? 'border-accent bg-accent/10'
                            : 'border-accent/40 bg-bg hover:bg-accent/5',
                        ].join(' ')}
                        aria-pressed={selected}
                      >
                        <p className="text-sm">
                          <span className="font-bold text-accent">
                            v{entrada.response_version}
                          </span>
                          <span className="text-ink">
                            {' '}
                            · {entrada.responded_by.display_name}
                          </span>
                        </p>
                        <p className="text-sm text-muted">
                          {narrativaMessage(entrada)}
                        </p>
                      </button>
                      {selected ? (
                        <div className="mt-1 space-y-1 rounded border border-border bg-bg px-3 py-2 text-sm">
                          <DetailRow
                            label="Versión"
                            value={`v${entrada.response_version}`}
                          />
                          <DetailRow
                            label="Actor"
                            value={entrada.responded_by.display_name}
                          />
                          <DetailRow
                            label="Acción"
                            value={
                              MILESTONE_ACCION[entrada.business_milestone] ??
                              entrada.business_milestone
                            }
                          />
                          <DetailRow
                            label="Resultado"
                            value={labelResponseStatus(entrada.response_status)}
                          />
                          <DetailRow label="Origen" value="MEP-LEAN" />
                          <DetailRow
                            label="Registrado"
                            value={formatDateTimeValue(entrada.responded_at)}
                          />
                          <DetailRow
                            label="Detalle"
                            value={entrada.narrative_note?.trim() || '—'}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Pista técnica separada de la narrativa comercial (INV-12). */}
            <div className="mt-4 rounded border border-border bg-bg">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted"
                onClick={() => setPistaOpen((open) => !open)}
                aria-expanded={pistaOpen}
              >
                {pistaOpen ? (
                  <ChevronDown size={14} aria-hidden />
                ) : (
                  <ChevronRight size={14} aria-hidden />
                )}
                Pista técnica · {solicitud.pista_tecnica.length} acuse(s)
              </button>
              {pistaOpen ? (
                <div className="border-t border-border px-3 py-3 text-sm">
                  {solicitud.pista_tecnica.length === 0 ? (
                    <p className="text-muted">
                      Aún no hay acuses técnicos de MEP-LEAN.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {solicitud.pista_tecnica.map((acuse) => (
                        <li
                          key={`${acuse.receipt_id}#${acuse.receipt_version}`}
                          className="space-y-0.5"
                        >
                          <DetailRow
                            label="Acuse"
                            value={`v${acuse.receipt_version} · ${
                              PROCESSING_STATUS_LABEL[acuse.processing_status] ??
                              acuse.processing_status
                            }`}
                          />
                          {acuse.reason_code ? (
                            <DetailRow label="Motivo" value={acuse.reason_code} />
                          ) : null}
                          <DetailRow
                            label="Registrado"
                            value={formatDateTimeValue(acuse.observed_at)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </ModalShell>

      <SharePointPreviewModal
        open={Boolean(preview)}
        title={preview?.title ?? ''}
        url={preview?.url ?? ''}
        onClose={() => setPreview(null)}
      />
    </>
  );
}

function SolicitudListItem({
  solicitud,
  onOpenService,
}: {
  solicitud: SolicitudPreventa;
  onOpenService: (service: ServiceCardView) => void;
}) {
  const services = tarjetasDeServicio(solicitud);
  const showPair = services.length > 1;
  const mepStatus = derivarMepStatus(solicitud);
  const sameContainer = esMismoContenedor(solicitud);

  return (
    <li className="rounded border border-border bg-bg p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MepStatusBadge status={mepStatus} />
          <span className={`${badgeClass} bg-accent/15 text-accent`}>
            {solicitud.service_horizon === 'IMMEDIATE' ? 'ASAP' : 'Sombra'}
          </span>
          <span className={`${badgeClass} bg-border text-ink`}>
            {nombreDelTipo(solicitud)}
          </span>
          <span className="text-xs text-muted">
            {solicitud.source_created_at
              ? new Date(solicitud.source_created_at).toLocaleString('es-CO')
              : '—'}
          </span>
        </div>
        <code className="text-xs text-muted">
          {solicitud.crm_interaction_ref}
        </code>
      </div>

      {showPair ? (
        <div
          className={[
            'grid gap-2 sm:grid-cols-2',
            sameContainer ? 'rounded border border-accent/30 bg-surface p-2' : '',
          ].join(' ')}
        >
          {sameContainer ? (
            <p className="text-xs font-bold text-muted sm:col-span-2">
              Misma solicitud — dos servicios
            </p>
          ) : (
            <p className="text-xs font-bold text-muted sm:col-span-2">
              Secuencia: técnica primero, financiera al recibir viabilidad
            </p>
          )}
          {services.map((card) => {
            const resultado = solicitud.servicios.find(
              (s) => s.service === card.service,
            );
            return (
              <ServiceCard
                key={card.service}
                card={card}
                serviceStatus={derivarEstadoServicio(resultado)}
                onOpen={() => onOpenService(card)}
              />
            );
          })}
        </div>
      ) : services[0] ? (
        <div className="max-w-sm">
          <ServiceCard
            card={services[0]}
            serviceStatus={derivarEstadoServicio(
              solicitud.servicios.find(
                (s) => s.service === services[0].service,
              ),
            )}
            onOpen={() => onOpenService(services[0])}
          />
        </div>
      ) : null}
    </li>
  );
}

/** Listado de Solicitudes Preventa. La creación va en modal por fases. */
export function PreventaActivityPanel({
  ouv,
  commercialOwnerName,
  readOnly = false,
}: Props) {
  const [items, setItems] = useState<SolicitudPreventa[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recargas, setRecargas] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<{
    solicitud: SolicitudPreventa;
    service: ServiceCardView;
  } | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  useEffect(() => {
    let vigente = true;

    fetchSolicitudesPreventa(ouv.ouv_id)
      .then((data) => {
        if (!vigente) return;
        setItems(data);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!vigente) return;
        setLoadError(
          err instanceof ApiError
            ? err.message
            : 'No fue posible cargar las solicitudes de preventa.',
        );
      })
      .finally(() => {
        if (vigente) setLoading(false);
      });

    return () => {
      vigente = false;
    };
  }, [ouv.ouv_id, recargas]);

  // Al cambiar de OUV se cierran modales y toast. En render, no en efecto.
  const [ouvCargada, setOuvCargada] = useState(ouv.ouv_id);
  if (ouvCargada !== ouv.ouv_id) {
    setOuvCargada(ouv.ouv_id);
    setModalOpen(false);
    setDetail(null);
    setToast(null);
  }

  function handleResult(result: {
    ok: boolean;
    message: string;
    record?: SolicitudPreventa;
  }) {
    if (result.ok && result.record) {
      setItems((prev) => [result.record as SolicitudPreventa, ...prev]);
      setModalOpen(false);
    }
    setToast({ ok: result.ok, message: result.message });
    window.setTimeout(() => setToast(null), 4500);
  }

  return (
    <section className={`${cardClass} mb-4 p-4`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Solicitudes Preventa</h2>
          <p className="text-xs text-muted">
            Historial de solicitudes enviadas a Preventa para esta OUV.
          </p>
        </div>
        {readOnly ? null : (
          <button
            type="button"
            className={ghostButtonClass}
            disabled={loading}
            onClick={() => setModalOpen(true)}
          >
            Nueva solicitud
          </button>
        )}
      </div>

      {toast ? (
        <FloatingToast
          message={toast.message}
          tone={toast.ok ? 'success' : 'error'}
          onDismiss={() => setToast(null)}
        />
      ) : null}

      {loadError ? (
        <div className="mb-3 flex items-center justify-between rounded border border-danger px-3 py-2">
          <span className="text-sm text-danger">{loadError}</span>
          <button
            type="button"
            className={ghostButtonClass}
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              setRecargas((n) => n + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="rounded border border-dashed border-border bg-bg px-3 py-8 text-center text-sm text-muted">
          Cargando solicitudes…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded border border-dashed border-border bg-bg px-3 py-8 text-center text-sm text-muted">
          {readOnly
            ? 'Aún no hay solicitudes de Preventa para esta OUV.'
            : 'Aún no hay solicitudes. Usa "Nueva solicitud" para crear una.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((solicitud) => (
            <SolicitudListItem
              key={solicitud.crm_interaction_ref}
              solicitud={solicitud}
              onOpenService={(service) => setDetail({ solicitud, service })}
            />
          ))}
        </ul>
      )}

      {modalOpen && !readOnly ? (
        <SolicitudPreventaModal
          ouv={ouv}
          commercialOwnerName={commercialOwnerName}
          existingSolicitudes={items}
          onClose={() => setModalOpen(false)}
          onResult={handleResult}
        />
      ) : null}

      {detail ? (
        <SolicitudDetailModal
          solicitud={detail.solicitud}
          service={detail.service}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </section>
  );
}
