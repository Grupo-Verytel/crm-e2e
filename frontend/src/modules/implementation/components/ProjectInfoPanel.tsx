import type { ReactNode } from 'react';
import { Layers, Smile, Star } from 'lucide-react';
import { formatDateTime } from '../../../lib/format';
import type { Ouv } from '../../discovery/api/ouvs-api';
import type { VentaGanadaRecord } from '../../shared/project/types';
import type { ProyectoEjecucion, TransicionEstado } from '../api/projects-api';
import { formatIsoDate } from '../lib/project-metrics';
import { cardClass } from './ui';

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

function Chip({
  icon,
  label,
  value,
  tone,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'neutral';
}) {
  const valueClass =
    tone === 'ok'
      ? 'text-success'
      : tone === 'warn'
        ? 'text-danger'
        : 'text-ink';
  return (
    <div className="flex min-w-0 items-center gap-2 rounded border border-border bg-surface px-3 py-2">
      {icon ? <span className="text-muted">{icon}</span> : null}
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className={`text-sm font-bold ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

/** Empresa(s) ejecutora(s) del expediente; si no hay, el cliente de la OUV. */
function empresaEjecutora(record: VentaGanadaRecord | null): string {
  const miembros = record?.datosBase.unionesTemporales ?? [];
  if (miembros.length > 0) return miembros.map((m) => m.nombre).join(' + ');
  const empresas = record?.datosBase.empresasEjecutoras ?? [];
  return empresas.length > 0 ? empresas.join(' + ') : '—';
}

/** CSAT más reciente en %: la última semana registrada o el valor suelto. */
function csatPercent(record: VentaGanadaRecord | null): number | null {
  if (!record) return null;
  const { csat } = record;
  const ultima = [...(csat.semanas ?? [])].sort((a, b) =>
    b.semanaIso.localeCompare(a.semanaIso),
  )[0];
  const valor = ultima?.valor ?? csat.valor;
  if (valor == null || csat.escala <= 0) return null;
  return (valor / csat.escala) * 100;
}

type Props = {
  ouv: Ouv | null;
  ejecucion: ProyectoEjecucion | null;
  /** Expediente de la venta ganada; `null` si la OUV no lo tiene. */
  record: VentaGanadaRecord | null;
  historial: TransicionEstado[] | null;
};

/**
 * Ficha del proyecto al estilo Control de Proyectos (diseño Design_JD), con
 * datos reales: nombre y gerente del PMO, fechas y empresas del expediente.
 */
export function ProjectInfoPanel({ ouv, ejecucion, record, historial }: Props) {
  const d = record?.datosBase ?? null;
  const estadoActual = historial?.length
    ? historial[historial.length - 1].newState
    : null;
  const csat = csatPercent(record);

  return (
    <section className={cardClass}>
      <h2 className="mb-4 text-base font-bold text-ink">
        Información del proyecto
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetaField
          label="Nombre del proyecto"
          value={ejecucion?.name || d?.nombreProyecto || ouv?.titulo || '—'}
        />
        <MetaField label="Cliente" value={ouv?.empresa_nombre ?? '—'} />
        <MetaField label="Empresa ejecutora" value={empresaEjecutora(record)} />
        <MetaField
          label="Gerente de proyecto"
          value={
            ejecucion?.projectManager ||
            d?.directorProyectoNombre ||
            'Sin asignar'
          }
        />
        <MetaField label="Fecha de inicio" value={formatIsoDate(d?.fechaInicio)} />
        <MetaField label="Fecha de fin" value={formatIsoDate(d?.fechaFin)} />
        <MetaField
          label="Fecha de asignación"
          value={formatIsoDate(record?.envioPmo.enviadoEn)}
        />
        <MetaField label="Estado" value={estadoActual ?? '—'} />
        <MetaField
          label="PMO"
          value={
            ejecucion
              ? `Control de Proyectos · #${ejecucion.projectId}`
              : 'Control de Proyectos'
          }
        />
        <MetaField
          label="Última actualización"
          value={record ? formatDateTime(record.updatedAt) : '—'}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Chip
          icon={<Star size={16} />}
          label="CSAT"
          value={csat == null ? '—' : `${csat.toFixed(0)}%`}
          tone={csat == null ? 'neutral' : csat >= 80 ? 'ok' : 'warn'}
        />
        <Chip
          icon={<Smile size={16} />}
          label="NPS"
          value={ejecucion?.nps == null ? '—' : String(ejecucion.nps)}
          tone="neutral"
        />
        <Chip
          icon={<Layers size={16} />}
          label="UBV"
          value={d?.ubv || '—'}
          tone="neutral"
        />
      </div>
    </section>
  );
}
