import { useEffect, useState } from 'react';
import { ExternalLink, FileText, ListChecks } from 'lucide-react';
import { formatDateTime } from '../../../lib/format';
import { ApiError } from '../../auth/types';
import type { Ouv } from '../api/ouvs-api';
import {
  fetchSolicitudesPreventa,
  type SolicitudPreventa,
  type SolicitudServicio,
} from '../api/solicitudes-preventa-api';
import {
  CAPACITY_STATUS_LABEL,
  ROUTE_STATUS_LABEL,
  SERVICE_HORIZON_LABEL,
} from '../lib/preventa-vocab';
import {
  MilestoneBadge,
  OutcomeBadge,
  ProcessingStatusBadge,
  ServiceStatusBadge,
} from './PreventaBadges';
import { SolicitudPreventaModal } from './SolicitudPreventaModal';
import { cardClass, ghostButtonClass, primaryButtonClass } from './ui';

type Props = {
  ouv: Ouv;
};

function mensajeDeError(err: unknown): string {
  return err instanceof ApiError
    ? err.message
    : 'No fue posible cargar las solicitudes de preventa.';
}

/**
 * Actividad de preventa de una OUV — Fase 3 (T-302, T-303, T-304).
 *
 * Tres reglas de presentación que el spec exige y que aquí se ven:
 *  - La narrativa de MEP va de más reciente a más antigua, con el contenido
 *    original del comercial siempre visible (T-302).
 *  - Planner, el registro de SharePoint List y los entregables de SharePoint
 *    Documents se muestran diferenciados (T-303 / AC-10): el registro de ruta
 *    y capacidad no es un entregable (INV-23, AC-29).
 *  - Los acuses técnicos viven en su propia pista, sin duplicar la narrativa
 *    comercial (T-304 / INV-12).
 */
export function PreventaActivityPanel({ ouv }: Props) {
  const [solicitudes, setSolicitudes] = useState<SolicitudPreventa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);
  /** Se incrementa para forzar una recarga desde el botón de reintento. */
  const [recargas, setRecargas] = useState(0);

  /**
   * El estado se actualiza solo dentro de los callbacks de la promesa, nunca
   * en el cuerpo del efecto. `vigente` descarta la respuesta de una OUV
   * anterior si el usuario navegó antes de que llegara.
   */
  useEffect(() => {
    let vigente = true;

    fetchSolicitudesPreventa(ouv.ouv_id)
      .then((data) => {
        if (!vigente) return;
        setSolicitudes(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!vigente) return;
        setError(mensajeDeError(err));
      })
      .finally(() => {
        if (vigente) setLoading(false);
      });

    return () => {
      vigente = false;
    };
  }, [ouv.ouv_id, recargas]);

  /** Reintento manual: en un handler sí se puede actualizar estado directo. */
  function reintentar() {
    setLoading(true);
    setError(null);
    setRecargas((n) => n + 1);
  }

  return (
    <section className={`${cardClass} p-4`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-ink">Preventa</h2>
          <p className="text-xs text-muted">
            Solicitudes enviadas a la fábrica y sus respuestas.
          </p>
        </div>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => setShowModal(true)}
        >
          Solicitar preventa
        </button>
      </div>

      {error ? (
        <div className="mb-3 flex items-center justify-between rounded border border-danger px-3 py-2">
          <span className="text-sm text-danger">{error}</span>
          <button type="button" className={ghostButtonClass} onClick={reintentar}>
            Reintentar
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Cargando solicitudes…</p>
      ) : solicitudes.length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay solicitudes de preventa para esta OUV.
        </p>
      ) : (
        <ul className="space-y-3">
          {solicitudes.map((solicitud) => (
            <SolicitudCard
              key={solicitud.crm_interaction_ref}
              solicitud={solicitud}
              expandida={expandida === solicitud.crm_interaction_ref}
              onToggle={() =>
                setExpandida(
                  expandida === solicitud.crm_interaction_ref
                    ? null
                    : solicitud.crm_interaction_ref,
                )
              }
            />
          ))}
        </ul>
      )}

      {showModal ? (
        <SolicitudPreventaModal
          ouv={ouv}
          onClose={() => setShowModal(false)}
          onCreated={(solicitud) => {
            setShowModal(false);
            setSolicitudes((prev) => [solicitud, ...prev]);
            setExpandida(solicitud.crm_interaction_ref);
          }}
        />
      ) : null}
    </section>
  );
}

function SolicitudCard({
  solicitud,
  expandida,
  onToggle,
}: {
  solicitud: SolicitudPreventa;
  expandida: boolean;
  onToggle: () => void;
}) {
  const { estado, ruta_capacidad: ruta } = solicitud;

  return (
    <li className="rounded border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MilestoneBadge hito={estado.hito} />
            <span className="text-xs text-muted">
              {SERVICE_HORIZON_LABEL[solicitud.service_horizon]}
            </span>
            <code className="text-xs text-muted">
              {solicitud.crm_interaction_ref}
            </code>
          </div>
          <p className="mt-1 text-sm font-bold text-ink">
            {solicitud.subject ?? 'Solicitud de preventa'}
          </p>
          <p className="text-xs text-muted">
            Enviada {formatDateTime(solicitud.source_created_at)}
            {estado.eta_date ? ` · ETA ${estado.eta_date}` : ''}
          </p>
        </div>
        <button type="button" className={ghostButtonClass} onClick={onToggle}>
          {expandida ? 'Ocultar' : 'Ver detalle'}
        </button>
      </div>

      {estado.next_milestone ? (
        <p className="mt-2 text-xs text-muted">
          Siguiente: {estado.next_milestone}
        </p>
      ) : null}

      {expandida ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {/* T-302: el contenido original, siempre visible. */}
          <div>
            <h3 className="mb-1 text-xs font-bold text-ink">
              Contenido original
            </h3>
            <p className="whitespace-pre-wrap rounded bg-bg p-3 text-sm text-ink">
              {solicitud.source_content}
            </p>
          </div>

          {solicitud.asignacion ? (
            <p className="text-sm text-ink">
              <span className="font-bold">Ingeniero:</span>{' '}
              {solicitud.asignacion.engineer.display_name}
              <span className="text-muted">
                {' '}
                · asignado {formatDateTime(solicitud.asignacion.assigned_at)}
              </span>
            </p>
          ) : null}

          <ServiciosSection servicios={solicitud.servicios} />

          {/* T-303 / AC-29: el registro de ruta/capacidad NO es un entregable. */}
          {ruta ? (
            <div>
              <h3 className="mb-1 text-xs font-bold text-ink">
                Ruta y capacidad · {ruta.version}
              </h3>
              <p className="text-sm text-ink">
                {ruta.route_status ? ROUTE_STATUS_LABEL[ruta.route_status] : '—'}
                {' · '}
                {ruta.capacity_status
                  ? CAPACITY_STATUS_LABEL[ruta.capacity_status]
                  : '—'}
              </p>
              {ruta.summary ? (
                <p className="text-sm text-muted">{ruta.summary}</p>
              ) : null}
              {ruta.registro_url ? (
                <a
                  href={ruta.registro_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
                >
                  <ListChecks size={14} aria-hidden />
                  Registro de ruta y capacidad
                  <span className="font-normal text-muted">
                    (SharePoint List — no es el entregable)
                  </span>
                </a>
              ) : null}
            </div>
          ) : null}

          {solicitud.planner_url ? (
            <a
              href={solicitud.planner_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
            >
              <ExternalLink size={14} aria-hidden />
              Tarea en Planner
            </a>
          ) : null}

          {solicitud.clasificacion_entregada ? (
            <p className="text-sm text-ink">
              <span className="font-bold">Clasificación entregada:</span>{' '}
              {solicitud.clasificacion_entregada}
            </p>
          ) : null}

          <NarrativaSection solicitud={solicitud} />
          <PistaTecnicaSection solicitud={solicitud} />
        </div>
      ) : null}
    </li>
  );
}

function ServiciosSection({ servicios }: { servicios: SolicitudServicio[] }) {
  if (servicios.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-bold text-ink">Servicios</h3>
      <ul className="space-y-2">
        {servicios.map((servicio) => (
          <li
            key={servicio.service}
            className="rounded border border-border p-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-ink">
                {servicio.label}
              </span>
              <ServiceStatusBadge status={servicio.status} />
              {servicio.outcome ? (
                <OutcomeBadge outcome={servicio.outcome} />
              ) : null}
              {servicio.bloqueado_por_dependencia ? (
                <span className="text-xs text-muted">
                  Espera el resultado técnico
                </span>
              ) : null}
            </div>

            {servicio.summary ? (
              <p className="mt-1 text-sm text-muted">{servicio.summary}</p>
            ) : null}

            {servicio.reason_code ? (
              <p className="mt-1 text-xs text-danger">
                Motivo: {servicio.reason_code}
              </p>
            ) : null}

            {/* T-303: los entregables son SharePoint Documents. */}
            {servicio.entregables.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {servicio.entregables.map((entregable) => (
                  <li key={entregable.url}>
                    <a
                      href={entregable.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
                    >
                      <FileText size={14} aria-hidden />
                      {entregable.label ?? 'Entregable'}
                      <span className="font-normal text-muted">
                        {entregable.published_at
                          ? ` · ${formatDateTime(entregable.published_at)}`
                          : ''}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** T-302 / TS-VER-08: de más reciente a más antigua, una entrada por versión. */
function NarrativaSection({ solicitud }: { solicitud: SolicitudPreventa }) {
  if (solicitud.narrativa.length === 0) {
    return (
      <p className="text-sm text-muted">
        Preventa todavía no ha publicado respuestas.
      </p>
    );
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-bold text-ink">Respuestas de Preventa</h3>
      <ol className="space-y-2">
        {solicitud.narrativa.map((entrada) => (
          <li
            key={entrada.response_version}
            className="border-l-2 border-brand pl-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <MilestoneBadge hito={entrada.business_milestone} />
              <span className="text-xs text-muted">
                v{entrada.response_version} ·{' '}
                {formatDateTime(entrada.responded_at)} ·{' '}
                {entrada.responded_by.display_name}
              </span>
            </div>
            {entrada.narrative_note ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                {entrada.narrative_note}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * T-304 / INV-12: pista técnica, separada de la narrativa comercial. Un acuse
 * confirma que MEP recibió el mensaje; no es el hito «Recibida».
 */
function PistaTecnicaSection({ solicitud }: { solicitud: SolicitudPreventa }) {
  if (solicitud.pista_tecnica.length === 0) {
    return null;
  }

  return (
    <details className="rounded bg-bg p-3">
      <summary className="cursor-pointer text-xs font-bold text-muted">
        Pista técnica · {solicitud.pista_tecnica.length} acuse(s) de recepción
      </summary>
      <ul className="mt-2 space-y-1">
        {solicitud.pista_tecnica.map((acuse) => (
          <li
            key={`${acuse.receipt_id}#${acuse.receipt_version}`}
            className="flex flex-wrap items-center gap-2 text-xs text-muted"
          >
            <ProcessingStatusBadge status={acuse.processing_status} />
            <span>{formatDateTime(acuse.observed_at)}</span>
            {acuse.reason_code ? <span>· {acuse.reason_code}</span> : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Confirma que la fábrica recibió la solicitud. No es un hito comercial.
      </p>
    </details>
  );
}
