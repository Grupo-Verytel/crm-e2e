import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import type { Ouv } from '../api/ouvs-api';
import {
  SOLICITUD_PREVENTA_FIELDS,
  mockFechaEntregaIso,
  mockPreventaAsignado,
  resolveServiceSharePoint,
  type ServiceCard,
} from '../lib/opportunity-context-fields';
import { SharePointPreviewModal } from '../../shared/project/SharePointPreviewModal';
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
};

const STORAGE_PREFIX = 'crm-ouv-solicitudes-preventa-v4-';

const MEP_STATUS_CLASS: Record<MepSolicitudStatus, string> = {
  Aceptado: 'bg-brand text-white',
  Completado: 'bg-success text-white',
  Rechazado: 'bg-danger text-white',
  Pendiente: 'bg-border text-muted',
};

function normalizeMepStatus(
  status: string | null | undefined,
): MepSolicitudStatus {
  if (status === 'Aprobado' || status === 'Completado') {
    return 'Completado';
  }
  if (
    status === 'Aceptado' ||
    status === 'Rechazado' ||
    status === 'Pendiente'
  ) {
    return status;
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

function loadSolicitudes(ouvId: string): SolicitudPreventaRecord[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${ouvId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SolicitudPreventaRecord[];
    const items = parsed.map((item) => ({
      ...item,
      mepStatus: normalizeMepStatus(item.mepStatus),
      preventaAsignado: item.preventaAsignado ?? null,
      observaciones: item.observaciones ?? '',
      viabilidad: item.viabilidad ?? null,
    }));
    localStorage.setItem(`${STORAGE_PREFIX}${ouvId}`, JSON.stringify(items));
    return items;
  } catch {
    return [];
  }
}

function saveSolicitudes(ouvId: string, items: SolicitudPreventaRecord[]): void {
  localStorage.setItem(`${STORAGE_PREFIX}${ouvId}`, JSON.stringify(items));
}

type DetailTab = 'informacion' | 'historico';

type PreventaHistoryDetail = {
  accion: string;
  resultado: string;
  origen: string;
  notas: string;
  registrado: string;
};

type PreventaHistoryEntry = {
  version: string;
  actor: string;
  message: string;
  detail: PreventaHistoryDetail;
};

function offsetIso(createdAt: string, hours: number): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

const detailTabClass = (active: boolean) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    active
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

function buildPreventaHistory(
  item: SolicitudPreventaRecord,
  service: ServiceCard,
  asignado: string,
): PreventaHistoryEntry[] {
  const created = item.createdAt;
  const entries: PreventaHistoryEntry[] = [
    {
      version: 'v1',
      actor: 'MEP-LEAN',
      message: 'La interacción fue recibida por MEP-LEAN.',
      detail: {
        accion: 'Recepción de la solicitud',
        resultado: 'La interacción quedó en cola de MEP-LEAN.',
        origen: 'Canal MEP-LEAN',
        notas: `Acuse automático de ${service.label}. Referencia ${item.interactionRef}.`,
        registrado: offsetIso(created, 0),
      },
    },
  ];
  if (item.mepStatus === 'Pendiente') {
    return entries;
  }

  entries.push({
    version: 'v2',
    actor: 'Ingeniero Preventa',
    message: 'Se asignó ingeniero de preventa a la interacción.',
    detail: {
      accion: 'Asignación de ingeniero',
      resultado: `Se asignó a ${asignado}.`,
      origen: 'Mesa de Preventa',
      notas: 'El ingeniero queda como responsable de la evaluación técnica.',
      registrado: offsetIso(created, 4),
    },
  });
  if (item.mepStatus === 'Aceptado') {
    return [...entries].reverse();
  }

  entries.push({
    version: 'v3',
    actor: 'Ingeniero Preventa',
    message:
      service.service === 'FINANCIAL_DESIGN'
        ? 'Ruta financiera y capacidad planificada quedaron registradas.'
        : 'Ruta viable V1, ETA y capacidad planificada quedaron registradas.',
    detail: {
      accion: 'Evaluación de ruta y capacidad',
      resultado:
        service.service === 'FINANCIAL_DESIGN'
          ? 'Quedó registrada la ruta financiera y la capacidad planificada.'
          : 'Quedaron registradas la ruta viable V1, el ETA y la capacidad planificada.',
      origen: asignado,
      notas: 'Se documentó el hallazgo en la pista técnica de la solicitud.',
      registrado: offsetIso(created, 28),
    },
  });
  if (item.mepStatus === 'Rechazado') {
    entries.push({
      version: 'v4',
      actor: 'Ingeniero Preventa',
      message: 'La solicitud fue rechazada por Preventa.',
      detail: {
        accion: 'Dictamen de viabilidad',
        resultado: 'No viable. La solicitud fue rechazada por Preventa.',
        origen: asignado,
        notas: 'No se emite diseño. Revisa observaciones y el historial de acuses.',
        registrado: offsetIso(created, 36),
      },
    });
    return [...entries].reverse();
  }

  entries.push({
    version: 'v5',
    actor: 'Ingeniero Preventa',
    message:
      item.tipoId === 'technical_and_financial'
        ? 'Diseño técnico y financiero entregados; interacción cerrada.'
        : service.service === 'FINANCIAL_DESIGN'
          ? 'Diseño financiero entregado; interacción cerrada.'
          : 'Diseño técnico entregado; interacción cerrada.',
    detail: {
      accion: 'Entrega de diseño y cierre',
      resultado:
        item.tipoId === 'technical_and_financial'
          ? 'Se entregaron el diseño técnico y el financiero. Interacción cerrada.'
          : service.service === 'FINANCIAL_DESIGN'
            ? 'Se entregó el diseño financiero. Interacción cerrada.'
            : 'Se entregó el diseño técnico. Interacción cerrada.',
      origen: asignado,
      notas: 'El documento de Preventa queda vinculado a esta solicitud.',
      registrado: offsetIso(created, 48),
    },
  });
  return [...entries].reverse();
}

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
  if (item.preventaAsignado) {
    return item.preventaAsignado;
  }
  if ((item.mepStatus ?? 'Pendiente') === 'Pendiente') {
    return 'Sin asignar';
  }
  return mockPreventaAsignado(item.id);
}

function resolveFechaEntrega(item: SolicitudPreventaRecord): string {
  const raw = item.values?.etag || item.etag || '';
  if (raw) {
    return formatDateTimeValue(raw);
  }
  if ((item.mepStatus ?? 'Pendiente') === 'Pendiente') {
    return '—';
  }
  return formatDateTimeValue(mockFechaEntregaIso(item.createdAt));
}

function resolveObservaciones(
  item: SolicitudPreventaRecord,
  history: PreventaHistoryEntry[],
): string {
  if (item.observaciones?.trim()) {
    return item.observaciones;
  }
  return history[0]?.message ?? 'Sin observaciones.';
}

function resolveViabilidad(item: SolicitudPreventaRecord): ViabilidadPreventa | null {
  if (item.viabilidad) {
    return item.viabilidad;
  }
  if ((item.mepStatus ?? 'Pendiente') === 'Pendiente') {
    return null;
  }
  return item.mepStatus === 'Rechazado' ? 'No viable' : 'Viable';
}

const DETAIL_INFO_FIELDS = SOLICITUD_PREVENTA_FIELDS.filter(
  (field) => field.key !== 'etag',
);

const fieldValueClass =
  'min-h-9 rounded border border-border bg-bg px-3 py-2 text-sm text-ink';

function ServiceCardView({
  card,
  mepStatus,
  onOpen,
}: {
  card: ServiceCard;
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
          Disponible cuando Preventa retorne el documento de viabilidad
          técnica.
        </p>
      ) : null}
    </button>
  );
}

function SolicitudDetailModal({
  item,
  service,
  consecutivo,
  onClose,
}: {
  item: SolicitudPreventaRecord;
  service: ServiceCard;
  consecutivo: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('informacion');
  const [preview, setPreview] = useState<{
    title: string;
    url: string;
  } | null>(null);
  const [pistaOpen, setPistaOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const sharepoint = resolveServiceSharePoint(consecutivo, service);
  const preventaAsignado = resolvePreventaAsignado(item);
  const history = buildPreventaHistory(item, service, preventaAsignado);
  const fechaEntrega = resolveFechaEntrega(item);
  const observaciones = resolveObservaciones(item, history);
  const viabilidad = resolveViabilidad(item);
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
              <div>
                <p className={labelClass}>Fecha de entrega</p>
                <p className={fieldValueClass}>{fechaEntrega}</p>
              </div>
              <div>
                <p className={labelClass}>Preventa asignado</p>
                <p className={fieldValueClass}>{preventaAsignado}</p>
              </div>
              <div>
                <p className={labelClass}>Viabilidad</p>
                <p className={fieldValueClass}>{viabilidad ?? '—'}</p>
              </div>
              <div>
                <p className={labelClass}>Documento</p>
                {sharepoint ? (
                  <button
                    type="button"
                    className="inline-flex min-h-9 w-full max-w-full items-center gap-2 rounded border border-border bg-bg px-3 py-2 text-left text-sm font-bold text-accent hover:underline"
                    onClick={() =>
                      setPreview({
                        title: sharepoint.nombre,
                        url: sharepoint.url,
                      })
                    }
                  >
                    <ExternalLink size={15} aria-hidden />
                    <span className="truncate text-accent">
                      {sharepoint.nombre}
                    </span>
                  </button>
                ) : (
                  <p className={`${fieldValueClass} text-muted`}>
                    Sin documento vinculado
                  </p>
                )}
              </div>
            </div>

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
                Pista técnica · {history.length} acuse(s)
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
  item,
  onDelete,
  onOpenService,
}: {
  item: SolicitudPreventaRecord;
  onDelete: () => void;
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
        <button type="button" className={ghostButtonClass} onClick={onDelete}>
          Eliminar
        </button>
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
              card={card}
              mepStatus={item.mepStatus ?? 'Pendiente'}
              onOpen={() => onOpenService(card)}
            />
          ))}
        </div>
      ) : services[0] ? (
        <div className="max-w-sm">
          <ServiceCardView
            card={services[0]}
            mepStatus={item.mepStatus ?? 'Pendiente'}
            onOpen={() => onOpenService(services[0])}
          />
        </div>
      ) : null}
    </li>
  );
}

/** Vista de listado de Solicitudes Preventa. La creación va en modal por fases. */
export function PreventaActivityPanel({ ouv, commercialOwnerName }: Props) {
  const [items, setItems] = useState<SolicitudPreventaRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<{
    item: SolicitudPreventaRecord;
    service: ServiceCard;
  } | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  useEffect(() => {
    setItems(loadSolicitudes(ouv.ouv_id));
    setModalOpen(false);
    setDetail(null);
    setToast(null);
  }, [ouv.ouv_id]);

  function handleResult(result: {
    ok: boolean;
    message: string;
    record?: SolicitudPreventaRecord;
  }) {
    if (result.ok && result.record) {
      const list = [result.record, ...items];
      setItems(list);
      saveSolicitudes(ouv.ouv_id, list);
      setModalOpen(false);
    }
    setToast({ ok: result.ok, message: result.message });
    window.setTimeout(() => setToast(null), 4500);
  }

  function handleDelete(id: string) {
    const list = items.filter((i) => i.id !== id);
    setItems(list);
    saveSolicitudes(ouv.ouv_id, list);
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

      {items.length === 0 ? (
        <p className="rounded border border-dashed border-border bg-bg px-3 py-8 text-center text-sm text-muted">
          Aún no hay solicitudes. Usa &quot;Nueva solicitud&quot; para crear una.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <SolicitudListItem
              key={item.id}
              item={item}
              onDelete={() => handleDelete(item.id)}
              onOpenService={(service) => setDetail({ item, service })}
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
          item={detail.item}
          service={detail.service}
          consecutivo={ouv.consecutivo}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </section>
  );
}
