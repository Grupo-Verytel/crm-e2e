/**
 * Controlled catalog for account economic_sector (UI select — not free text).
 * Values match seed demos and common Verytel account profiles.
 */
export const ECONOMIC_SECTORS = [
  'Manufactura',
  'Telecomunicaciones',
  'Tecnología',
  'Servicios financieros',
  'Comercio mayorista',
  'Comercio minorista',
  'Construcción',
  'Energía y utilities',
  'Salud',
  'Educación',
  'Transporte y logística',
  'Agricultura',
  'Minería y petróleo',
  'Gobierno y sector público',
  'Defensa y seguridad',
  'Servicios profesionales',
  'Medios y entretenimiento',
  'Turismo y hotelería',
  'Otro',
] as const;

export type EconomicSector = (typeof ECONOMIC_SECTORS)[number];
