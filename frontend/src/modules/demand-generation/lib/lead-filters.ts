import type { Segmento } from '../types';

/** Global Leads filters, shared verbatim by the list, board and exceptions views. */
export type LeadFilterValues = {
  segmento: Segmento | '';
  campana_id: string;
  responsable_id: string;
  from: string;
  to: string;
};

export const EMPTY_LEAD_FILTERS: LeadFilterValues = {
  segmento: '',
  campana_id: '',
  responsable_id: '',
  from: '',
  to: '',
};
