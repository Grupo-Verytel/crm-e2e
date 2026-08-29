import type { DraftFilters } from '../lib/ouv-filters';
import { OUV_ZONA_LABEL, OUV_ZONAS } from '../lib/ouv-vocab';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  open: boolean;
  draft: DraftFilters;
  onDraftChange: (next: DraftFilters) => void;
  onApply: () => void;
  onClear: () => void;
};

/**
 * Inline filter panel for OUV bandeja — expands under the toolbar, not a modal.
 */
export function OuvFiltersPanel({
  open,
  draft,
  onDraftChange,
  onApply,
  onClear,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="mb-4 border-b border-border bg-bg px-1 pb-4 pt-1"
      role="region"
      aria-label="Filtros de oportunidades"
    >
      <div className="grid gap-3 md:grid-cols-5">
        <div>
          <label className={labelClass} htmlFor="ouv-f-q">
            Buscar
          </label>
          <input
            id="ouv-f-q"
            className={inputClass}
            value={draft.q}
            onChange={(e) => onDraftChange({ ...draft, q: e.target.value })}
            placeholder="Título, empresa, OUV-"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="ouv-f-zona">
            Zona
          </label>
          <select
            id="ouv-f-zona"
            className={inputClass}
            value={draft.zona}
            onChange={(e) => onDraftChange({ ...draft, zona: e.target.value })}
          >
            <option value="">Todas</option>
            {OUV_ZONAS.map((z) => (
              <option key={z} value={z}>
                {OUV_ZONA_LABEL[z]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="ouv-f-gap">
            Gap
          </label>
          <select
            id="ouv-f-gap"
            className={inputClass}
            value={draft.tiene_gap}
            onChange={(e) =>
              onDraftChange({ ...draft, tiene_gap: e.target.value })
            }
          >
            <option value="">Todos</option>
            <option value="true">Con gap</option>
            <option value="false">Sin gap</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="ouv-f-from">
            Desde
          </label>
          <input
            id="ouv-f-from"
            type="date"
            className={inputClass}
            value={draft.created_from}
            onChange={(e) =>
              onDraftChange({ ...draft, created_from: e.target.value })
            }
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="ouv-f-to">
            Hasta
          </label>
          <input
            id="ouv-f-to"
            type="date"
            className={inputClass}
            value={draft.created_to}
            onChange={(e) =>
              onDraftChange({ ...draft, created_to: e.target.value })
            }
          />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className={primaryButtonClass} onClick={onApply}>
          Aplicar filtros
        </button>
        <button type="button" className={ghostButtonClass} onClick={onClear}>
          Limpiar
        </button>
      </div>
    </div>
  );
}
