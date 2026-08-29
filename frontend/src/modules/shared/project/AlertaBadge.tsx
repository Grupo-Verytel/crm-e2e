import type { AlertaEstado, AlertaRecord } from './types';

const ESTADO_CLASS: Record<AlertaEstado, string> = {
  Pendiente: 'border-warning/40 bg-warning/10 text-warning',
  Activa: 'border-accent/40 bg-accent/10 text-accent',
  Resuelta: 'border-positive/40 bg-positive/10 text-positive',
};

type Props = {
  alerta: AlertaRecord;
  compact?: boolean;
};

/** C1 — shared alert badge (HU-F01 + HU-F08). */
export function AlertaBadge({ alerta, compact = false }: Props) {
  return (
    <div
      className={`rounded border px-3 py-2 ${ESTADO_CLASS[alerta.estado]} ${compact ? 'text-xs' : 'text-sm'}`}
      role="status"
    >
      <p className="font-bold">{alerta.tipo}</p>
      <p className={compact ? 'mt-0.5' : 'mt-1'}>{alerta.descripcion}</p>
      {!compact ? (
        <p className="mt-1 text-xs opacity-80">
          {alerta.estado} · {new Date(alerta.fecha).toLocaleDateString('es-CO')}
        </p>
      ) : null}
    </div>
  );
}

export function AlertaBanner({ alerta }: { alerta: AlertaRecord }) {
  return (
    <div className="mb-4">
      <AlertaBadge alerta={alerta} />
    </div>
  );
}
