export type DraftFilters = {
  zona: string;
  tiene_gap: string;
  q: string;
  created_from: string;
  created_to: string;
};

export const EMPTY_OUV_FILTERS: DraftFilters = {
  zona: '',
  tiene_gap: '',
  q: '',
  created_from: '',
  created_to: '',
};

export function countActiveOuvFilters(filters: DraftFilters): number {
  return Object.values(filters).filter((v) => v !== '').length;
}
