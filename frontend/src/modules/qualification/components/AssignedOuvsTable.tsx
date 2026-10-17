import { FollowUpDot } from './FollowUpDot';
import type { AssignedOuvItem } from '../types/assigned-ouvs.types';

const ZONA_LABEL: Record<string, string> = {
  UNIVERSO: 'Universo',
  ENCIMA_FUNNEL: 'Encima Funnel',
  EN_FUNNEL: 'En Funnel',
  MAYOR_PROBABILIDAD: 'Mayor Probabilidad',
};

type Props = {
  items: AssignedOuvItem[];
  loading: boolean;
  onRowClick: (ouvId: string) => void;
  emptyLabel?: string;
};

export function AssignedOuvsTable({
  items,
  loading,
  onRowClick,
  emptyLabel = 'No hay OUV asignadas todavía.',
}: Props) {
  if (loading) {
    return <p className="text-sm text-muted">Cargando…</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-bold">OUV</th>
            <th className="px-4 py-3 font-bold">Título</th>
            <th className="px-4 py-3 font-bold">Empresa</th>
            <th className="px-4 py-3 font-bold">Etapa</th>
            <th className="px-4 py-3 font-bold">Comercial</th>
            <th className="px-4 py-3 text-center font-bold">Seguimiento</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.ouv_id}
              onClick={() => onRowClick(item.ouv_id)}
              className="cursor-pointer border-b border-border hover:bg-bg"
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  className="font-bold text-accent hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRowClick(item.ouv_id);
                  }}
                >
                  {item.consecutivo}
                </button>
              </td>
              <td className="px-4 py-3 text-ink">{item.titulo}</td>
              <td className="px-4 py-3 text-ink">{item.empresa_nombre}</td>
              <td className="px-4 py-3 text-ink">
                {ZONA_LABEL[item.zona_actual] ?? item.zona_actual}
              </td>
              <td className="px-4 py-3 text-ink">
                {item.comercial_nombre?.trim() || '—'}
              </td>
              <td className="px-4 py-3 text-center">
                <FollowUpDot
                  status={item.follow_up_status}
                  nextReminderAt={item.next_reminder_at}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
