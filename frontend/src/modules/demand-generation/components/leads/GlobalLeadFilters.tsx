import type { FormEvent } from 'react';
import {
  CANALES_ORIGEN,
  ORIGENES_LEAD,
  SEGMENTOS,
  type CanalOrigen,
  type OrigenLead,
  type Segmento,
} from '../../types';
import { inputClass, labelClass } from '../ui';
import type { LeadFilterValues } from '../../lib/lead-filters';
import { CANAL_ORIGEN_LABEL } from '../../lib/lead-vocab';
import { segmentoLabel } from '../../lib/segment-catalog';

type CampaignOption = { campana_id: string; nombre: string };

type Props = {
  draft: LeadFilterValues;
  onChange: (next: LeadFilterValues) => void;
  onApply: () => void;
  onClear: () => void;
  campaigns: CampaignOption[];
};

export function GlobalLeadFilters({
  draft,
  onChange,
  onApply,
  onClear,
  campaigns,
}: Props) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply();
  }

  return (
    <div className="mb-4">
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded bg-surface p-4 shadow-card md:grid-cols-4 xl:grid-cols-7"
      >
        <div>
          <label htmlFor="f-canal-origen" className={labelClass}>
            Canal de origen
          </label>
          <select
            id="f-canal-origen"
            value={draft.canal_origen}
            onChange={(event) =>
              onChange({
                ...draft,
                canal_origen: event.target.value as CanalOrigen | '',
              })
            }
            className={inputClass}
          >
            <option value="">Todos</option>
            {CANALES_ORIGEN.map((canal) => (
              <option key={canal} value={canal}>
                {CANAL_ORIGEN_LABEL[canal]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-origen" className={labelClass}>
            Origen
          </label>
          <select
            id="f-origen"
            value={draft.origen}
            onChange={(event) =>
              onChange({
                ...draft,
                origen: event.target.value as OrigenLead | '',
              })
            }
            className={inputClass}
          >
            <option value="">Todos</option>
            {ORIGENES_LEAD.map((origin) => (
              <option key={origin} value={origin}>
                {origin}
              </option>
            ))}
          </select>
        </div>

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
                {segmentoLabel(segmento)}
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

        <div className="flex items-end gap-2 md:col-span-4 xl:col-span-7">
          <button
            type="submit"
            className="btn-glow rounded px-4 py-2 text-sm font-bold text-white"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={onClear}
            className="btn-glow-outline rounded px-4 py-2 text-sm font-bold"
          >
            Limpiar
          </button>
        </div>
      </form>
    </div>
  );
}
