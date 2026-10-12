import { Filter } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CommercialOption } from '../api/sqls-api';
import { type AssignedCommercialFilters } from '../lib/assigned-filters';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  panelId: string;
  commercials: CommercialOption[];
  applied: AssignedCommercialFilters;
  onApply: (next: AssignedCommercialFilters) => void;
};

export function AssignedCommercialFiltersPanel({
  panelId,
  commercials,
  applied,
  onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AssignedCommercialFilters>(applied);

  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  const filterButtonClass = [
    'grid h-9 w-9 place-items-center',
    open ? 'btn-glow text-white' : 'btn-glow-outline !border-0',
  ].join(' ');

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <div
          className="inline-flex items-center bg-transparent p-0"
          role="toolbar"
          aria-label="Acciones de bandeja"
        >
          <button
            type="button"
            className={filterButtonClass}
            onClick={() => setOpen((current) => !current)}
            aria-label="Mostrar filtros"
            aria-expanded={open}
            aria-controls={panelId}
            title="Filtros"
          >
            <Filter size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div id={panelId}>
        {open ? (
          <div
            className="mb-4 border-b border-border bg-bg px-1 pb-4 pt-1"
            role="region"
            aria-label="Filtros"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-56 flex-1 md:max-w-xs">
                <label className={labelClass} htmlFor={`${panelId}-comercial`}>
                  Comercial asignado
                </label>
                <select
                  id={`${panelId}-comercial`}
                  className={inputClass}
                  value={draft.comercial_id}
                  onChange={(event) =>
                    setDraft({ comercial_id: event.target.value })
                  }
                >
                  <option value="">Todos</option>
                  {commercials.map((commercial) => (
                    <option
                      key={commercial.user_id}
                      value={commercial.user_id}
                    >
                      {commercial.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => onApply(draft)}
                >
                  Aplicar filtros
                </button>
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => {
                    const empty = { comercial_id: '' };
                    setDraft(empty);
                    onApply(empty);
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
