import { useEffect, useState } from 'react';
import { ApiError } from '../../auth/types';
import type { Ouv } from '../api/ouvs-api';
import {
  fetchSolicitudesPreventa,
  type SolicitudPreventa,
  type SolicitudServicio,
} from '../api/solicitudes-preventa-api';
import {
  SOLICITUD_PREVENTA_FIELDS,
  SERVICE_LABELS,
} from '../lib/opportunity-context-fields';
import { FloatingToast } from './FloatingToast';
import { ModalShell } from './ModalShell';
import { SharePointDocumentLink } from './SharePointDocumentLink';
import { SolicitudPreventaModal } from './SolicitudPreventaModal';
import { badgeClass, cardClass, ghostButtonClass, labelClass } from './ui';

type Props = {
  ouv: Ouv;
  commercialOwnerName?: string;
};

/** Estado que la UI muestra por solicitud, derivado de los datos reales. */
export type MepSolicitudStatus =
  | 'Aceptado'
  | 'Aprobado'
  | 'Rechazado'
  | 'Pendiente';

const MEP_STATUS_CLASS: Record<MepSolicitudStatus, string> = {
  Aceptado: 'bg-accent text-white',
  Aprobado: 'bg-success text-white',
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

/**
 * En el diseño este estado se sorteaba al azar (`MEP_MOCK_STATUSES`). Acá sale
 * de los hechos reales: el cierre comercial manda; si no, el último acuse
 * técnico; si no hay nada, la solicitud sigue pendiente.
 */
function derivarMepStatus(solicitud: SolicitudPreventa): MepSolicitudStatus {
  if (solicitud.estado.hito === 'INTERACTION_COMPLETED') {
    return 'Aprobado';
  }

  const acuse = solicitud.pista_tecnica[0];
  if (acuse) {
    if (
      acuse.processing_status === 'REJECTED' ||
      acuse.processing_status === 'QUARANTINED'
    ) {
      return 'Rechazado';
    }
    return 'Aceptado';
  }

  return solicitud.estado.hito ? 'Aceptado' : 'Pendiente';
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
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString('es-CO');
  }
  return value;
}

function ServiceCard({
  card,
  mepStatus,
  onOpen,
}: {
  card: ServiceCardView;
  mepStatus: MepSolicitudStatus;
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
        <MepStatusBadge status={mepStatus} />
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
  const values = valoresDeSolicitud(solicitud);
  const resultado = solicitud.servicios.find(
    (s) => s.service === service.service,
  );

  return (
    <ModalShell
      title={`Detalle — ${service.label}`}
      onClose={onClose}
      size="wide"
      headerAside={<MepStatusBadge status={derivarMepStatus(solicitud)} />}
    >
      <div className="mb-4 flex flex-wrap gap-2">
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
        <span className={`${badgeClass} bg-border text-ink`}>
          {nombreDelTipo(solicitud)}
        </span>
        <span className={`${badgeClass} bg-accent/15 text-accent`}>
          {solicitud.service_horizon === 'IMMEDIATE' ? 'ASAP' : 'Sombra'}
        </span>
        {service.state === 'blocked' ? (
          <span className={`${badgeClass} bg-border text-muted`}>
            Bloqueada — espera viabilidad Preventa
          </span>
        ) : null}
      </div>

      {solicitud.sharepoint_document_url ? (
        <div className="mb-4">
          <SharePointDocumentLink url={solicitud.sharepoint_document_url} />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {SOLICITUD_PREVENTA_FIELDS.map((field) => (
          <div
            key={field.key}
            className={field.spanFull ? 'sm:col-span-2' : undefined}
          >
            <p className={labelClass}>{field.label}</p>
            <p className="whitespace-pre-wrap text-sm text-ink">
              {formatFieldValue(field.key, values[field.key] ?? '')}
            </p>
          </div>
        ))}
      </div>

      {resultado ? (
        <div className="mt-4 rounded border border-border bg-bg p-3">
          <p className={`${labelClass} mb-2`}>Respuesta de Preventa</p>
          {resultado.summary ? (
            <p className="text-sm text-ink">{resultado.summary}</p>
          ) : null}
          {/* Entregables: SharePoint Documents; el registro de ruta no lo es. */}
          {resultado.entregables.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {resultado.entregables.map((entregable) => (
                <li key={entregable.url}>
                  <a
                    href={entregable.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-accent hover:underline"
                  >
                    {entregable.label ?? 'Entregable'}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Narrativa MEP: más reciente primero (T-302). */}
      {solicitud.narrativa.length > 0 ? (
        <div className="mt-4">
          <p className={`${labelClass} mb-2`}>Historial de Preventa</p>
          <ol className="space-y-2">
            {solicitud.narrativa.map((entrada) => (
              <li
                key={entrada.response_version}
                className="border-l-2 border-accent pl-3"
              >
                <p className="text-xs text-muted">
                  v{entrada.response_version} ·{' '}
                  {entrada.responded_by.display_name}
                </p>
                {entrada.narrative_note ? (
                  <p className="whitespace-pre-wrap text-sm text-ink">
                    {entrada.narrative_note}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* Pista técnica separada de la narrativa comercial (INV-12). */}
      {solicitud.pista_tecnica.length > 0 ? (
        <details className="mt-4 rounded bg-bg p-3">
          <summary className="cursor-pointer text-xs font-bold text-muted">
            Pista técnica · {solicitud.pista_tecnica.length} acuse(s)
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {solicitud.pista_tecnica.map((acuse) => (
              <li key={`${acuse.receipt_id}#${acuse.receipt_version}`}>
                {acuse.processing_status}
                {acuse.reason_code ? ` · ${acuse.reason_code}` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Confirma que la fábrica recibió la solicitud. No es un hito
            comercial.
          </p>
        </details>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button type="button" className={ghostButtonClass} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </ModalShell>
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
          {services.map((card) => (
            <ServiceCard
              key={card.service}
              card={card}
              mepStatus={mepStatus}
              onOpen={() => onOpenService(card)}
            />
          ))}
        </div>
      ) : services[0] ? (
        <div className="max-w-sm">
          <ServiceCard
            card={services[0]}
            mepStatus={mepStatus}
            onOpen={() => onOpenService(services[0])}
          />
        </div>
      ) : null}
    </li>
  );
}

/** Listado de Solicitudes Preventa. La creación va en modal por fases. */
export function PreventaActivityPanel({ ouv, commercialOwnerName }: Props) {
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
        <button
          type="button"
          className={ghostButtonClass}
          onClick={() => setModalOpen(true)}
        >
          Nueva solicitud
        </button>
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
          Aún no hay solicitudes. Usa &quot;Nueva solicitud&quot; para crear una.
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

      {modalOpen ? (
        <SolicitudPreventaModal
          ouv={ouv}
          commercialOwnerName={commercialOwnerName}
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
