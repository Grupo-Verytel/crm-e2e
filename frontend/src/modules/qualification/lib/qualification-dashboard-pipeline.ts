import { listVentasGanadas } from '../../shared/project/mock-store';
import type { VentaGanadaRecord } from '../../shared/project/types';

export type QualificationPipelineClientMetrics = {
  offer_to_implementation: number;
  implementation_to_post_sales: number;
};

function parseRangeStart(isoDate: string): number {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00`).getTime();
}

function parseRangeEnd(isoDate: string): number {
  return new Date(`${isoDate.slice(0, 10)}T23:59:59.999`).getTime();
}

function inRange(
  iso: string | null | undefined,
  from: string,
  to: string,
): boolean {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  return ts >= parseRangeStart(from) && ts <= parseRangeEnd(to);
}

function inYearQuarter(
  iso: string | null | undefined,
  year: number,
  quarter?: number | null,
): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) return false;
  if (quarter == null) return true;
  const month = d.getMonth();
  const q = Math.floor(month / 3) + 1;
  return q === quarter;
}

function filterVentasByPeriod(
  ventas: VentaGanadaRecord[],
  options: {
    periodFrom?: string;
    periodTo?: string;
    year?: number | null;
    quarter?: number | null;
  },
): VentaGanadaRecord[] {
  const { periodFrom, periodTo, year, quarter } = options;
  if (periodFrom && periodTo) {
    return ventas.filter((v) =>
      inRange(v.envioPmo.enviadoEn ?? v.updatedAt, periodFrom, periodTo),
    );
  }
  if (year != null) {
    return ventas.filter((v) =>
      inYearQuarter(v.envioPmo.enviadoEn ?? v.updatedAt, year, quarter),
    );
  }
  return ventas;
}

/** Handoffs stored in ventas ganadas mock (Oferta → Implementación → Posventa). */
export function computeQualificationPipelineClientMetrics(options: {
  periodFrom?: string;
  periodTo?: string;
  year?: number | null;
  quarter?: number | null;
  periodActive: boolean;
}): QualificationPipelineClientMetrics {
  const ventas = listVentasGanadas();
  const scoped = options.periodActive
    ? filterVentasByPeriod(ventas, options)
    : ventas;

  const offerToImplementation = scoped.filter(
    (v) => v.envioPmo.estado === 'Enviado' && Boolean(v.envioPmo.serConsecutivo),
  ).length;

  const implementationToPostSales = scoped.filter((v) => {
    const sent = v.envioPmo.estado === 'Enviado';
    const csatDone =
      v.csat.valor != null ||
      (v.csat.semanas != null && v.csat.semanas.length > 0);
    return sent && csatDone;
  }).length;

  return {
    offer_to_implementation: offerToImplementation,
    implementation_to_post_sales: implementationToPostSales,
  };
}
