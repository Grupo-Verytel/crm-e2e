import { Segmento } from '../models/enums/segment.enum';

export const INDUSTRIA_SEGMENT_NAME = Segmento.Industria;

export const TIPOS_INDUSTRIA = [
  'Retail',
  'Hidrocarburos',
  'Energia',
] as const;

export type TipoIndustria = (typeof TIPOS_INDUSTRIA)[number];

const LEGACY_SEGMENTO_TO_CANONICAL: Record<string, Segmento> = {
  Gobierno: Segmento.GobiernoCentral,
  'D&S': Segmento.DefensaYSeguridad,
  ProyectosEspeciales: Segmento.CiudadesYGobernaciones,
  'Proyectos Especiales': Segmento.CiudadesYGobernaciones,
  'Seguridad ciudadana': Segmento.CiudadesYGobernaciones,
  B2B: Segmento.Industria,
};

export function resolveSegmentoFromInput(value: string): Segmento | null {
  if ((Object.values(Segmento) as string[]).includes(value)) {
    return value as Segmento;
  }
  return LEGACY_SEGMENTO_TO_CANONICAL[value] ?? null;
}

export function isIndustriaSegmento(segmento: string | null | undefined): boolean {
  return (
    segmento === Segmento.Industria ||
    segmento === 'B2B' ||
    segmento === INDUSTRIA_SEGMENT_NAME
  );
}
