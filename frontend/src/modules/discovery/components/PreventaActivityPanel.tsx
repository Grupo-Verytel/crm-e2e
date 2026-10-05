import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import type { Ouv } from '../api/ouvs-api';
import { fetchSolicitudesPreventa } from '../api/solicitudes-preventa-api';
import {
  SOLICITUD_PREVENTA_FIELDS,
  type ServiceCard,
} from '../lib/opportunity-context-fields';
import {
  buildHistoryFromSolicitud,
  collectDocumentosForService,
  derivarEstadoServicio,
  mapSolicitudPreventaToRecord,
  type DocumentoLink,
} from '../lib/solicitud-preventa-mapper';
import { labelTipoInteraccionPreventa } from '../lib/preventa-vocab';
import { externalResourceDisplayName } from '../lib/sharepoint-document';
import { ModalShell } from './ModalShell';
import {
  SolicitudPreventaModal,
  type MepSolicitudStatus,
  type SolicitudPreventaRecord,
  type ViabilidadPreventa,
} from './SolicitudPreventaModal';
import {
  badgeClass,
  cardClass,
  ghostButtonClass,
  labelClass,
} from './ui';
import { FloatingToast } from './FloatingToast';

type Props = {
  ouv: Ouv;
  commercialOwnerName?: string;
  readOnly?: boolean;
};

const MEP_STATUS_CLASS: Record<MepSolicitudStatus, string> = {
  Aceptado: 'bg-brand text-white',
  'En progreso': 'bg-accent/80 text-white',
  'Parcialmente completo': 'bg-warning text-ink',
  Completado: 'bg-success text-white',
  Cancelado: 'bg-border text-muted',
  Rechazado: 'bg-danger text-white',
  Pendiente: 'bg-border text-muted',
};

function normalizeMepStatus(
  status: string | null | undefined,
): MepSolicitudStatus {
  if (status && status in MEP_STATUS_CLASS) {
    return status as MepSolicitudStatus;
  }
  if (status === 'Aprobado') {
    return 'Completado';
  }
  return 'Pendiente';
}

function MepStatusBadge({ status }: { status: MepSolicitudStatus }) {
  const normalized = normalizeMepStatus(status);
  return (
    <span className={`${badgeClass} ${MEP_STATUS_CLASS[normalized]}`}>
      {normalized}
    </span>
  );
}

type DetailTab = 'informacion' | 'historico';

const detailTabClass = (active: boolean) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    active
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

function formatFieldValue(key: string, value: string): string {
  if (!value) {
    return '—';
  }
  if (key === 'source_created_at' || key === 'etag') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString('es-CO');
  }
  return value;
}

function formatDateTimeValue(value: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('es-CO');
}

function resolvePreventaAsignado(item: SolicitudPreventaRecord): string {
  const name = item.api.asignacion?.engineer.display_name?.trim();
  if (name) {
    return name;
  }
  return 'Sin asignar';
}

function resolveFechaEntrega(item: SolicitudPreventaRecord): string {
  const raw = item.api.estado.eta_date;
  if (raw) {
    return formatDateTimeValue(raw);
  }
  return '—';
}

function resolveFechaCierre(item: SolicitudPreventaRecord): string {
  if (item.api.estado.fecha_cierre) {
    return formatDateTimeValue(item.api.estado.fecha_cierre);
  }
  return '—';
}

function resolveTipoInteraccion(item: SolicitudPreventaRecord): string {
  return labelTipoInteraccionPreventa(item.api.clasificacion_entregada);
}

function resolveObservaciones(item: SolicitudPreventaRecord): string {
  const note = item.api.narrativa[0]?.narrative_note?.trim();
  if (note) {
    return note;
  }
  return item.api.source_content?.trim() || 'Sin observaciones.';
}

function resolveViabilidad(item: SolicitudPreventaRecord): ViabilidadPreventa | null {
  return item.viabilidad;
}

const DETAIL_INFO_FIELDS = SOLICITUD_PREVENTA_FIELDS;

const fieldValueClass =
  'min-h-9 rounded border border-border bg-bg px-3 py-2 text-sm text-ink';

function SharePointDocumentField({
  url,
  nombre,
  emptyLabel = 'Sin documento vinculado',
}: {
  url: string | null | undefined;
  nombre?: string;
  emptyLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const trimmed = url?.trim();
  if (!trimmed) {
    return (
      <p
        className={`${fieldValueClass} text-muted`}
        aria-disabled="true"
      >
        {emptyLabel}
      </p>
    );
  }
  const href: string = trimmed;

  const displayName =
    nombre?.trim() ||
    externalResourceDisplayName(href, undefined);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="group relative w-full max-w-full">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-9 w-full max-w-full items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-left text-sm font-bold text-accent hover:underline"
      >
        <ExternalLink size={15} aria-hidden />
        <span className="truncate text-accent">{displayName}</span>
      </a>
      <button
        type="button"
        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={copied ? 'Enlace copiado' : 'Copiar enlace del documento'}
        title={copied ? 'Copiado' : 'Copiar enlace'}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void handleCopy();
        }}
      >
        <Copy size={15} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

function DocumentoLinkList({
  items,
  emptyLabel = 'Sin documento vinculado',
}: {
  items: DocumentoLink[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return (
      <p className={`${fieldValueClass} text-muted`} aria-disabled="true">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Documentos vinculados">
      {items.map((doc) => (
        <li key={doc.url}>
          <SharePointDocumentField url={doc.url} nombre={doc.label} />
        </li>
      ))}
    </ul>
  );
}

function ViabilidadDocumentoLinks({
  items,
  fieldLabel,
}: {
  items: DocumentoLink[];
  fieldLabel: string;
}) {
  if (items.length === 0) {
    return (
      <span className="text-muted" aria-disabled="true">
        Sin documento vinculado
      </span>
    );
  }

  if (items.length === 1) {
    const doc = items[0];
    return (
      <CardPlannetLink
        url={doc.url}
        fieldLabel={fieldLabel}
        linkText={doc.label}
      />
    );
  }

  return (
    <ul className="space-y-1">
      {items.map((doc) => (
        <li key={doc.url}>
          <CardPlannetLink
            url={doc.url}
            fieldLabel={fieldLabel}
            linkText={doc.label}
          />
        </li>
      ))}
    </ul>
  );
}

function CardPlannetLink({
  url,
  fieldLabel,
  linkText,
  emptyLabel = '—',
}: {
  url: string | null | undefined;
  fieldLabel: string;
  linkText?: string;
  emptyLabel?: string;
}) {
  const trimmed = url?.trim();
  if (!trimmed) {
    return (
      <span className="text-muted" aria-disabled="true">
        {emptyLabel}
      </span>
    );
  }
  const href: string = trimmed;

  const displayText = externalResourceDisplayName(href, linkText);

  async function handleCopy(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(href);
    } catch {
      /* ignore */
    }
  }

  return (
    <span className="group/link inline-flex max-w-full items-center gap-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 truncate font-bold text-accent hover:underline"
        title={href}
        onClick={(event) => event.stopPropagation()}
      >
        {displayText}
      </a>
      <button
        type="button"
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted opacity-0 transition-opacity hover:text-accent group-hover/link:opacity-100"
        aria-label={`Copiar enlace de ${fieldLabel}`}
        onClick={(event) => void handleCopy(event)}
      >
        <Copy size={11} strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}

function CardInfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold leading-snug text-muted">{label}</p>
      <div className="mt-0.5 min-w-0 text-xs leading-snug text-ink">{children}</div>
    </div>
  );
}

function ServiceCardView({
  item,
  card,
  mepStatus,
  onOpen,
}: {
  item: SolicitudPreventaRecord;
  card: ServiceCard;
  mepStatus: MepSolicitudStatus;
  onOpen: () => void;
}) {
  const active = card.state === 'active';
  const showResponse = item.status === 'ENVIADA';
  const interactionRef = item.interactionRef || item.values.crm_interaction_ref;
  const plannetUrl = item.api.planner_url ?? null;
  const routeCapacityUrl = item.api.ruta_capacidad?.registro_url ?? null;
  const tipoInteraccion = resolveTipoInteraccion(item);
  const documentos = collectDocumentosForService(item.api, card.service);
  const viabilidadDocLabel =
    card.service === 'FINANCIAL_DESIGN'
      ? 'Viabilidad financiera'
      : 'Viabilidad técnica';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        'w-full rounded border p-3 text-left transition-colors',
        active
          ? 'border-border bg-surface hover:border-accent/40'
          : 'border-border bg-bg opacity-55 hover:opacity-80',
      ].join(' ')}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={[
              badgeClass,
              active ? 'bg-accent text-white' : 'bg-border text-muted',
            ].join(' ')}
          >
            {card.label}
          </span>
          <MepStatusBadge status={mepStatus} />
        </div>
        {active ? (
          <span className="shrink-0 text-xs font-bold text-accent">Activa</span>
        ) : (
          <span className="shrink-0 text-xs font-bold text-muted">
            Bloqueada
          </span>
        )}
      </div>
      {!active ? (
        <p className="mt-2 text-xs text-muted">
          Disponible cuando Preventa retorne el documento de viabilidad
          técnica.
        </p>
      ) : null}

      {showResponse ? (
        <div
          className="mt-2.5 space-y-2.5 border-t border-border/40 pt-2.5"
          role="group"
          aria-label="Respuesta Preventa"
        >
          <CardInfoRow label="Interaction URL (Plannet)">
            <CardPlannetLink
              url={plannetUrl}
              fieldLabel="Interaction URL (Plannet)"
              linkText={`Interacción ${interactionRef}`}
            />
          </CardInfoRow>
          <CardInfoRow label="Route Capacity URL">
            <CardPlannetLink
              url={routeCapacityUrl}
              fieldLabel="Route Capacity URL"
              linkText={`Registro de ruta · ${card.label}`}
            />
          </CardInfoRow>
          <CardInfoRow label={viabilidadDocLabel}>
            <ViabilidadDocumentoLinks
              items={documentos}
              fieldLabel={viabilidadDocLabel}
            />
          </CardInfoRow>
          <CardInfoRow label="Tipo de interacción">
            <span className="font-bold text-ink">{tipoInteraccion}</span>
          </CardInfoRow>
        </div>
      ) : null}
    </button>
  );
}

function SolicitudDetailModal({
  item,
  service,
  onClose,
}: {
  item: SolicitudPreventaRecord;
  service: ServiceCard;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('informacion');
  const [pistaOpen, setPistaOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const documentos = collectDocumentosForService(item.api, service.service);
  const preventaAsignado = resolvePreventaAsignado(item);
  const history = buildHistoryFromSolicitud(item.api);
  const fechaEntrega = resolveFechaEntrega(item);
  const tipoInteraccion = resolveTipoInteraccion(item);
  const fechaCierre = resolveFechaCierre(item);
  const observaciones = resolveObservaciones(item);
  const viabilidad = resolveViabilidad(item);
  const showRespuesta = item.status === 'ENVIADA';
  const selectedEntry =
    history.find((entry) => entry.version === selectedVersion) ?? null;
  const showTipoBadge =
    item.tipoNombre.trim().toLowerCase() !== service.label.trim().toLowerCase();

  function handleSelectHistory(version: string) {
    setSelectedVersion(version);
    setPistaOpen(true);
  }

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
            {showTipoBadge ? (
              <span className={`${badgeClass} bg-border text-ink`}>
                {item.tipoNombre}
              </span>
            ) : null}
            <span className={`${badgeClass} bg-accent/15 text-accent`}>
              {item.priority === 'ASAP' ? 'ASAP' : 'Sombra'}
            </span>
            {service.state === 'blocked' ? (
              <span className={`${badgeClass} bg-border text-muted`}>
                Bloqueada
              </span>
            ) : null}
            <MepStatusBadge status={item.mepStatus ?? 'Pendiente'} />
          </div>
        }
      >
        <nav
          className="mb-4 flex flex-wrap gap-1 border-b border-border"
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
              {DETAIL_INFO_FIELDS.map((field) => {
                const raw = item.values[field.key] ?? '';
                return (
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
                      {formatFieldValue(field.key, raw)}
                    </p>
                  </div>
                );
              })}
            </div>

            {showRespuesta ? (
              <div className="mt-4 rounded border border-border bg-bg p-3">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
                  Respuesta Preventa
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className={labelClass}>Fecha de entrega</p>
                    <p className={fieldValueClass}>{fechaEntrega}</p>
                  </div>
                  <div>
                    <p className={labelClass}>Tipo de interacción</p>
                    <p className={fieldValueClass}>{tipoInteraccion}</p>
                  </div>
                  <div>
                    <p className={labelClass}>Fecha de cierre</p>
                    <p className={fieldValueClass}>{fechaCierre}</p>
                  </div>
                  <div>
                    <p className={labelClass}>Preventa asignado</p>
                    <p className={fieldValueClass}>{preventaAsignado}</p>
                  </div>
                  <div>
                    <p className={labelClass}>Viabilidad</p>
                    <p className={fieldValueClass}>{viabilidad ?? '—'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className={labelClass}>Documentos</p>
                    <DocumentoLinkList items={documentos} />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded border border-border bg-bg p-3">
              <p className={labelClass}>Observaciones</p>
              <p className="min-h-20 whitespace-pre-wrap text-sm text-ink">
                {observaciones}
              </p>
            </div>
          </>
        ) : (
          <div>
            <p className="mb-3 text-xs font-bold text-muted">
              Historial de Preventa
            </p>
            <ul className="space-y-2">
              {history.map((entry) => {
                const selected = entry.version === selectedVersion;
                return (
                  <li key={entry.version}>
                    <button
                      type="button"
                      onClick={() => handleSelectHistory(entry.version)}
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
                          {entry.version}
                        </span>
                        <span className="text-ink"> · {entry.actor}</span>
                      </p>
                      <p className="text-sm text-muted">{entry.message}</p>
                    </button>
                  </li>
                );
              })}
            </ul>

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
                Pista técnica · {item.api.pista_tecnica.length} acuse(s)
              </button>
              {pistaOpen ? (
                <div className="space-y-2 border-t border-border px-3 py-3 text-sm">
                  {selectedEntry ? (
                    <>
                      <p>
                        <span className="font-bold text-ink">Versión: </span>
                        <span className="text-accent">
                          {selectedEntry.version}
                        </span>
                      </p>
                      <p>
                        <span className="font-bold text-ink">Actor: </span>
                        <span className="text-ink">{selectedEntry.actor}</span>
                      </p>
                      <p>
                        <span className="font-bold text-ink">Acción: </span>
                        <span className="text-ink">
                          {selectedEntry.detail.accion}
                        </span>
                      </p>
                      <p>
                        <span className="font-bold text-ink">Resultado: </span>
                        <span className="text-ink">
                          {selectedEntry.detail.resultado}
                        </span>
                      </p>
                      <p>
                        <span className="font-bold text-ink">Origen: </span>
                        <span className="text-ink">
                          {selectedEntry.detail.origen}
                        </span>
                      </p>
                      <p>
                        <span className="font-bold text-ink">Registrado: </span>
                        <span className="text-ink">
                          {formatDateTimeValue(selectedEntry.detail.registrado)}
                        </span>
                      </p>
                      <p>
                        <span className="font-bold text-ink">Detalle: </span>
                        <span className="text-ink">
                          {selectedEntry.detail.notas}
                        </span>
                      </p>
                    </>
                  ) : (
                    <p className="text-muted">
                      Elige un evento del historial para ver el detalle de la
                      acción.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </ModalShell>
    </>
  );
}

function SolicitudListItem({
  item,
  onOpenService,
}: {
  item: SolicitudPreventaRecord;
  onOpenService: (service: ServiceCard) => void;
}) {
  const services = item.services ?? [];
  const showPair = services.length > 1;

  return (
    <li className="rounded border border-border bg-bg p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MepStatusBadge status={item.mepStatus ?? 'Pendiente'} />
          <span className={`${badgeClass} bg-accent/15 text-accent`}>
            {item.priority === 'ASAP' ? 'ASAP' : 'Sombra'}
          </span>
          <span className={`${badgeClass} bg-border text-ink`}>
            {item.tipoNombre}
          </span>
          <span className="text-xs text-muted">
            {new Date(item.createdAt).toLocaleString('es-CO')}
          </span>
        </div>
      </div>

      {showPair ? (
        <div
          className={[
            'grid gap-2 sm:grid-cols-2',
            item.sameContainer
              ? 'rounded border border-accent/30 bg-surface p-2'
              : '',
          ].join(' ')}
        >
          {item.sameContainer ? (
            <p className="sm:col-span-2 text-xs font-bold text-muted">
              Misma solicitud — dos servicios
            </p>
          ) : (
            <p className="sm:col-span-2 text-xs font-bold text-muted">
              Secuencia: técnica primero, financiera al recibir viabilidad
            </p>
          )}
          {services.map((card) => (
            <ServiceCardView
              key={card.service}
              item={item}
              card={card}
              mepStatus={derivarEstadoServicio(
                item.api.servicios.find((s) => s.service === card.service),
              )}
              onOpen={() => onOpenService(card)}
            />
          ))}
        </div>
      ) : services[0] ? (
        <div className="max-w-sm">
          <ServiceCardView
            item={item}
            card={services[0]}
            mepStatus={derivarEstadoServicio(
              item.api.servicios.find((s) => s.service === services[0].service),
            )}
            onOpen={() => onOpenService(services[0])}
          />
        </div>
      ) : null}
    </li>
  );
}

/** Vista de listado de Solicitudes Preventa. La creación va en modal por fases. */
export function PreventaActivityPanel({
  ouv,
  commercialOwnerName,
  readOnly = false,
}: Props) {
  const [items, setItems] = useState<SolicitudPreventaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<{
    item: SolicitudPreventaRecord;
    service: ServiceCard;
  } | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const reload = useCallback(async () => {
    try {
      const data = await fetchSolicitudesPreventa(ouv.ouv_id);
      setItems(data.map(mapSolicitudPreventaToRecord));
      setLoadError(null);
    } catch {
      setLoadError('No se pudieron cargar las solicitudes de Preventa.');
    } finally {
      setLoading(false);
    }
  }, [ouv.ouv_id]);

  useEffect(() => {
    setLoading(true);
    setModalOpen(false);
    setDetail(null);
    setToast(null);
    void reload();
  }, [reload]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void reload();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  function handleResult(result: {
    ok: boolean;
    message: string;
    created?: import('../api/solicitudes-preventa-api').SolicitudPreventa;
  }) {
    if (result.ok) {
      setModalOpen(false);
      void reload();
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
            onClick={() => setModalOpen(true)}
          >
            Nueva solicitud
          </button>
        )}
      </div>

      {loadError ? (
        <p className="mb-3 text-sm text-danger" role="alert">
          {loadError}
        </p>
      ) : null}

      {toast ? (
        <FloatingToast
          message={toast.message}
          tone={toast.ok ? 'success' : 'error'}
          onDismiss={() => setToast(null)}
        />
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
          {items.map((item) => (
            <SolicitudListItem
              key={item.id}
              item={item}
              onOpenService={(service) => setDetail({ item, service })}
            />
          ))}
        </ul>
      )}

      {modalOpen && !readOnly ? (
        <SolicitudPreventaModal
          ouv={ouv}
          commercialOwnerName={commercialOwnerName}
          existingSolicitudes={items.map((row) => row.api)}
          onClose={() => setModalOpen(false)}
          onResult={handleResult}
        />
      ) : null}

      {detail ? (
        <SolicitudDetailModal
          item={detail.item}
          service={detail.service}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </section>
  );
}
