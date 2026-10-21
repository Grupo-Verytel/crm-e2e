import { Filter } from 'lucide-react';
import { useState } from 'react';
import { commercialOptionLabel } from '../../discovery/api/catalogos-api';
import type {
  AssignedOuvFilters,
  FollowUpStatus,
} from '../types/assigned-ouvs.types';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

const FOLLOW_UP_OPTIONS: Array<{ value: FollowUpStatus; label: string }> = [
  { value: 'RED', label: 'Vencido' },
  { value: 'YELLOW', label: 'Próximo' },
  { value: 'GREEN', label: 'Al día' },
  { value: 'NONE', label: 'Sin seguimiento' },
];

const EMPTY_FILTERS: AssignedOuvFilters = {
  comercial_id: '',
  follow_up_status: [],
};

export type CommercialOption = {
  user_id: string;
  full_name: string;
  role_name?: string;
};

type Props = {
  panelId: string;
  commercials: CommercialOption[];
  applied: AssignedOuvFilters;
  onApply: (next: AssignedOuvFilters) => void;
  /** Hidden for EjecutivoComercial. The server still ignores `comercial_id`. */
  showCommercial?: boolean;
};

export function AssignedCommercialFiltersPanel({
  panelId,
  commercials,
  applied,
  onApply,
  showCommercial = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AssignedOuvFilters>(applied);
  const [seenApplied, setSeenApplied] = useState(applied);
  if (applied !== seenApplied) {
    setSeenApplied(applied);
    setDraft(applied);
  }

  const filterButtonClass = [
    'grid h-9 w-9 place-items-center',
    open ? 'btn-glow text-white' : 'btn-glow-outline !border-0',
  ].join(' ');

  function toggleStatus(status: FollowUpStatus): void {
    setDraft((current) => {
      const selected = current.follow_up_status.includes(status)
        ? current.follow_up_status.filter((item) => item !== status)
        : [...current.follow_up_status, status];
      return { ...current, follow_up_status: selected };
    });
  }

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
              {showCommercial ? (
                <div className="min-w-56 flex-1 md:max-w-xs">
                  <label className={labelClass} htmlFor={`${panelId}-comercial`}>
                    Comercial asignado
                  </label>
                  <select
                    id={`${panelId}-comercial`}
                    className={inputClass}
                    value={draft.comercial_id}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        comercial_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Todos</option>
                    {commercials.map((commercial) => (
                      <option key={commercial.user_id} value={commercial.user_id}>
                        {commercialOptionLabel(commercial)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <fieldset className="min-w-56 flex-1">
                <legend className={labelClass}>Seguimiento</legend>
                <div className="flex flex-wrap gap-3">
                  {FOLLOW_UP_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 text-sm text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={draft.follow_up_status.includes(option.value)}
                        onChange={() => toggleStatus(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
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
                    setDraft(EMPTY_FILTERS);
                    onApply(EMPTY_FILTERS);
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
