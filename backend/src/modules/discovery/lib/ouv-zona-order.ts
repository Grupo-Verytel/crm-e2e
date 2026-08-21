import { OuvZona } from '../models/enums/ouv.enums';

/** Ordered funnel zones (Wave 1). */
export const OUV_ZONA_ORDER: OuvZona[] = [
  OuvZona.Universo,
  OuvZona.EncimaFunnel,
  OuvZona.EnFunnel,
  OuvZona.MayorProbabilidad,
];

export function nextZona(zona: OuvZona): OuvZona | null {
  const idx = OUV_ZONA_ORDER.indexOf(zona);
  if (idx < 0 || idx >= OUV_ZONA_ORDER.length - 1) {
    return null;
  }
  return OUV_ZONA_ORDER[idx + 1];
}

export function prevZona(zona: OuvZona): OuvZona | null {
  const idx = OUV_ZONA_ORDER.indexOf(zona);
  if (idx <= 0) {
    return null;
  }
  return OUV_ZONA_ORDER[idx - 1];
}

export function zonaRank(zona: OuvZona): number {
  return OUV_ZONA_ORDER.indexOf(zona);
}
