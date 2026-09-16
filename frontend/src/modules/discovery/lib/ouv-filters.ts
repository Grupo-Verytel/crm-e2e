export type DraftFilters = {
  zona: string;
  tiene_gap: string;
  canal_origen: string;
  created_from: string;
  created_to: string;
};

export const OUV_SOURCE_CHANNEL_OPTIONS = [
  { value: 'CAMPANA_DIGITAL', label: 'Marketing Digital' },
  { value: 'BTL', label: 'BTL' },
  { value: 'EVENTOS', label: 'Eventos' },
  { value: 'FABRICA', label: 'Fábrica' },
  {
    value: 'GENERACION_DEMANDA_AGENCIA',
    label: 'Generación de demanda (agencia)',
  },
  { value: 'TRADUCTOR_NEGOCIO', label: 'Traductor de negocio' },
  { value: 'REFERIDO', label: 'Referido' },
] as const;

export const EMPTY_OUV_FILTERS: DraftFilters = {
  zona: '',
  tiene_gap: '',
  canal_origen: '',
  created_from: '',
  created_to: '',
};

export function countActiveOuvFilters(filters: DraftFilters): number {
  return Object.values(filters).filter((v) => v !== '').length;
}
