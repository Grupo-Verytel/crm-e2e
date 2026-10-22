import { Pencil, Trash2 } from 'lucide-react';
import { formatCopDisplay } from '../lib/cop-amount';
import {
  formatBogotaTimestamp,
  formatVerytelQuarterRange,
  formatVerytelQuarterTitle,
  verytelQuarterRange,
  type VerytelQuarter,
} from '../lib/verytel-quarter';
import type { CommercialGoal } from '../types';
import { iconButtonClass } from './ui';

const MANAGER_ROLE = 'Gerente Comercial';

type Props = {
  items: CommercialGoal[];
  highlightedId: string | null;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (goal: CommercialGoal) => void;
  onDelete: (goal: CommercialGoal) => void;
};

export function CommercialGoalsTable({
  items,
  highlightedId,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-bold uppercase tracking-wide text-muted">
            <th className="px-3 py-2 font-bold">Comercial</th>
            <th className="px-3 py-2 font-bold">Periodo</th>
            <th className="px-3 py-2 font-bold">Segmento</th>
            <th className="px-3 py-2 text-right font-bold">Meta (COP)</th>
            <th className="px-3 py-2 font-bold">Actualizada</th>
            <th className="px-3 py-2 font-bold">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((goal) => {
            const quarter = goal.quarter as VerytelQuarter;
            const range = verytelQuarterRange(goal.fiscal_year, quarter);
            const highlighted = goal.commercial_goal_id === highlightedId;
            return (
              <tr
                key={goal.commercial_goal_id}
                className={[
                  'border-b border-border',
                  highlighted ? 'bg-accent/10 motion-safe:transition-colors' : '',
                ].join(' ')}
              >
                <td className="px-3 py-3 text-ink">
                  <span className="font-bold">{goal.commercial_full_name}</span>
                  {goal.commercial_role_name === MANAGER_ROLE ? (
                    <span className="ml-2 inline-flex rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                      Gerente
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <p className="text-ink">
                    {formatVerytelQuarterTitle(goal.fiscal_year, quarter)}
                  </p>
                  <p className="text-xs text-muted">
                    {formatVerytelQuarterRange(range)}
                  </p>
                </td>
                <td className="px-3 py-3 text-ink">{goal.segment_name}</td>
                <td className="px-3 py-3 text-right tabular-nums text-ink">
                  {formatCopDisplay(goal.amount_cop)}
                </td>
                <td className="px-3 py-3 text-muted">
                  {formatBogotaTimestamp(goal.updated_at)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    {canUpdate ? (
                      <button
                        type="button"
                        className={iconButtonClass}
                        aria-label={`Editar la meta de ${goal.commercial_full_name}`}
                        onClick={() => onEdit(goal)}
                      >
                        <Pencil size={16} aria-hidden />
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        type="button"
                        className={iconButtonClass}
                        aria-label={`Eliminar la meta de ${goal.commercial_full_name}`}
                        onClick={() => onDelete(goal)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
