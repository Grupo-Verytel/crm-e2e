import { useEffect, useState } from 'react';
import type { Ouv } from '../api/ouvs-api';
import {
  SOLICITUD_PREVENTA_FIELDS,
  type ServiceCard,
} from '../lib/opportunity-context-fields';
import { ModalShell } from './ModalShell';
import {
  SolicitudPreventaModal,
  type MepSolicitudStatus,
  type SolicitudPreventaRecord,
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

function loadSolicitudes(ouvId: string): SolicitudPreventaRecord[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${ouvId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SolicitudPreventaRecord[];
    return parsed.map((item) => ({
      ...item,
      mepStatus: item.mepStatus ?? 'Pendiente',
    }));
  } catch {
    return [];
  }
}

function saveSolicitudes(ouvId: string, items: SolicitudPreventaRecord[]): void {
  localStorage.setItem(`${STORAGE_PREFIX}${ouvId}`, JSON.stringify(items));
}

function formatFieldValue(key: string, value: string): string {
  if (!value) {
    // Fecha de respuesta (etag): vacío hasta que MEP la asigne.
    if (key === 'etag') return '';
    return '—';
  }
  if (key === 'source_created_at') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString('es-CO');
  }
  return value;
}

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
  onClose,
}: {
  item: SolicitudPreventaRecord;
  service: ServiceCard;
  onClose: () => void;
}) {
  return (
    <ModalShell
      title={`Detalle — ${service.label}`}
      onClose={onClose}
      size="wide"
      headerAside={<MepStatusBadge status={item.mepStatus ?? 'Pendiente'} />}
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
          {item.tipoNombre}
        </span>
        <span className={`${badgeClass} bg-accent/15 text-accent`}>
          {item.priority === 'ASAP' ? 'ASAP' : 'Sombra'}
        </span>
        {service.state === 'blocked' ? (
          <span className={`${badgeClass} bg-border text-muted`}>
            Bloqueada — espera viabilidad Preventa
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SOLICITUD_PREVENTA_FIELDS.map((field) => {
          const raw = item.values[field.key] ?? '';
          return (
            <div
              key={field.key}
              className={field.spanFull ? 'sm:col-span-2' : undefined}
            >
              <p className={labelClass}>{field.label}</p>
              <p className="whitespace-pre-wrap text-sm text-ink">
                {formatFieldValue(field.key, raw)}
              </p>
            </div>
          );
        })}
      </div>
    </ModalShell>
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
          onClose={() => setDetail(null)}
        />
      ) : null}
    </section>
  );
}
