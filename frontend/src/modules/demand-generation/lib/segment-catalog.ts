import type { Segmento } from '../types';

export const INDUSTRIA_SEGMENT_NAME = 'Industria';

export const TIPOS_INDUSTRIA = [
  'Retail',
  'Hidrocarburos',
  'Energia',
] as const;

export type TipoIndustria = (typeof TIPOS_INDUSTRIA)[number];

const LEGACY_SEGMENTO_LABEL: Record<string, Segmento> = {
  Gobierno: 'Gobierno central',
  'D&S': 'Defensa y seguridad',
  ProyectosEspeciales: 'Ciudades y gobernaciones',
  'Proyectos Especiales': 'Ciudades y gobernaciones',
  'Seguridad ciudadana': 'Ciudades y gobernaciones',
  B2B: 'Industria',
};

export function segmentoLabel(segmento: string): string {
  return LEGACY_SEGMENTO_LABEL[segmento] ?? segmento;
}

export function isIndustriaSegmento(segmento: string | undefined | null): boolean {
  return (
    segmento === INDUSTRIA_SEGMENT_NAME ||
    segmento === 'B2B' ||
    segmentoLabel(segmento ?? '') === INDUSTRIA_SEGMENT_NAME
  );
}
