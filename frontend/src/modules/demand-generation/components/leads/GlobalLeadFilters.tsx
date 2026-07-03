import type { FormEvent } from 'react';
import { SEGMENTOS, type Segmento } from '../../types';
import { inputClass, labelClass } from '../ui';
import type { LeadsViewMode } from '../../hooks/useLeadsViewPreference';
import type { LeadFilterValues } from '../../lib/lead-filters';

type CampaignOption = { campana_id: string; nombre: string };

type Props = {
  draft: LeadFilterValues;
  onChange: (next: LeadFilterValues) => void;
  onApply: () => void;
  onClear: () => void;
  campaigns: CampaignOption[];
  view: LeadsViewMode;
  showExceptions: boolean;
  onSelectView: (view: LeadsViewMode) => void;
  onSelectExceptions: () => void;
  exceptionsCount: number | null;
};

export function GlobalLeadFilters({
  draft,
  onChange,
  onApply,
  onClear,
  campaigns,
  view,
  showExceptions,
  onSelectView,
  onSelectExceptions,
  exceptionsCount,
}: Props) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply();
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div
          className="inline-flex rounded border border-border bg-surface p-0.5"
          role="group"
          aria-label="Cambiar vista de leads"
        >
          <ToggleButton
            active={!showExceptions && view === 'list'}
            onClick={() => onSelectView('list')}
          >
            Lista
          </ToggleButton>
          <ToggleButton
            active={!showExceptions && view === 'kanban'}
            onClick={() => onSelectView('kanban')}
          >
            Tablero
          </ToggleButton>
        </div>

        <button
          type="button"
          onClick={onSelectExceptions}
          aria-pressed={showExceptions}
          className={[
            'rounded border px-3 py-1.5 text-sm font-bold transition-colors',
            showExceptions
              ? 'border-warning bg-surface text-warning'
              : 'border-border bg-surface text-muted hover:text-ink',
          ].join(' ')}
        >
          Excepciones
          {exceptionsCount != null ? (
            <span className="ml-1.5 text-xs font-normal">({exceptionsCount})</span>
          ) : null}
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded bg-surface p-4 shadow-card md:grid-cols-5"
      >
        <div>
          <label htmlFor="f-campana" className={labelClass}>
            Campaña
          </label>
          <select
            id="f-campana"
            value={draft.campana_id}
            onChange={(event) =>
              onChange({ ...draft, campana_id: event.target.value })
            }
            className={inputClass}
          >
            <option value="">Todas</option>
            {campaigns.map((campaign) => (
              <option key={campaign.campana_id} value={campaign.campana_id}>
                {campaign.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-segmento" className={labelClass}>
            Segmento
          </label>
          <select
            id="f-segmento"
            value={draft.segmento}
            onChange={(event) =>
              onChange({ ...draft, segmento: event.target.value as Segmento | '' })
            }
            className={inputClass}
          >
            <option value="">Todos</option>
            {SEGMENTOS.map((segmento) => (
              <option key={segmento} value={segmento}>
                {segmento}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-responsable" className={labelClass}>
            Responsable (ID)
          </label>
          <input
            id="f-responsable"
            value={draft.responsable_id}
            onChange={(event) =>
              onChange({ ...draft, responsable_id: event.target.value })
            }
            placeholder="ID del gestor"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="f-from" className={labelClass}>
            Captura desde
          </label>
          <input
            id="f-from"
            type="date"
            value={draft.from}
            onChange={(event) => onChange({ ...draft, from: event.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="f-to" className={labelClass}>
            Captura hasta
          </label>
          <input
            id="f-to"
            type="date"
            value={draft.to}
            onChange={(event) => onChange({ ...draft, to: event.target.value })}
            className={inputClass}
          />
        </div>

        <div className="flex items-end gap-2 md:col-span-5">
          <button
            type="submit"
            className="rounded bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded border border-border px-4 py-2 text-sm font-bold text-ink hover:bg-bg"
          >
            Limpiar
          </button>
        </div>
      </form>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-sm px-3 py-1 text-sm font-bold transition-colors',
        active ? 'bg-brand text-white' : 'text-muted hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
