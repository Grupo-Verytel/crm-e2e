import type { ReactNode } from 'react';
import {
  BadgePercent,
  Layers,
  Star,
  Timer,
} from 'lucide-react';
import type { VentaGanadaRecord } from '../../shared/project/types';
import {
  buildIndicadoresVs,
  csatPercent,
  empresaLabel,
  formatIsoDate,
  formatIsoDateTime,
  formatPct,
} from '../lib/project-metrics';
import { IndicadoresDashboard } from './IndicadoresDashboard';
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

type Props = {
  record: VentaGanadaRecord;
};

/** Ficha del proyecto al estilo Control de Proyectos. */
export function ProjectInfoPanel({ record }: Props) {
  const d = record.datosBase;
  const csat = csatPercent(record);

  return (
    <div className="space-y-4">
      <section className={cardClass}>
        <h2 className="mb-4 text-base font-bold text-ink">
          Información del proyecto
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaField label="Nombre del proyecto" value={d.nombreProyecto} />
          <MetaField label="Empresa" value={empresaLabel(record)} />
          <MetaField
            label="Gerente de proyecto"
            value={d.directorProyectoNombre ?? 'Sin asignar'}
          />
          <MetaField
            label="Fecha de inicio"
            value={formatIsoDate(d.fechaInicio)}
          />
          <MetaField label="Fecha de fin" value={formatIsoDate(d.fechaFin)} />
          <MetaField
            label="Fecha de asignación"
            value={formatIsoDate(record.envioPmo.enviadoEn)}
          />
          <MetaField
            label="Estado"
            value={
              record.indicadores.ejecucion.valor ??
              record.indicadores.ejecucion.estado
            }
          />
          <MetaField label="PMO" value="Control de Proyectos" />
          <MetaField
            label="Última actualización"
            value={formatIsoDateTime(record.updatedAt)}
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Chip
            icon={<Star size={16} />}
            label="CSAT"
            value={csat == null ? '—' : formatPct(csat, 0)}
            tone={csat != null && csat >= 80 ? 'ok' : 'neutral'}
          />
          <Chip
            icon={<BadgePercent size={16} />}
            label="Score"
            value="98.2%"
            tone="ok"
          />
          <Chip
            icon={<Layers size={16} />}
            label="UBV"
            value={d.participacionPct ? formatPct(d.participacionPct, 1) : '—'}
            tone="ok"
          />
          <Chip
            icon={<Timer size={16} />}
            label="Fuentes"
            value="9.7%"
            tone="neutral"
          />
        </div>
      </section>

      <IndicadoresDashboard vs={buildIndicadoresVs(record)} />
    </div>
  );
}
