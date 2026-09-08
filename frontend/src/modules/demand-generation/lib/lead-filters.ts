import type { CanalOrigen, Segmento } from '../types';

/** Global Leads filters, shared verbatim by the list, board and exceptions views. */
export type LeadFilterValues = {
  canal_origen: CanalOrigen | '';
  segmento: Segmento | '';
  campana_id: string;
  responsable_id: string;
  from: string;
  to: string;
};

export const EMPTY_LEAD_FILTERS: LeadFilterValues = {
  canal_origen: '',
  segmento: '',
  campana_id: '',
  responsable_id: '',
  from: '',
  to: '',
};

export function countActiveLeadFilters(filters: LeadFilterValues): number {
  let count = 0;
  if (filters.canal_origen) count += 1;
  if (filters.segmento) count += 1;
  if (filters.campana_id) count += 1;
  if (filters.responsable_id) count += 1;
  if (filters.from) count += 1;
  if (filters.to) count += 1;
  return count;
}
