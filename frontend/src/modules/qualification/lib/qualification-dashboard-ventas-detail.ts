import { listVentasGanadas } from '../../shared/project/mock-store';
import type { VentaGanadaRecord } from '../../shared/project/types';
import type { QualificationDashboardDetailItem } from '../api/qualification-dashboard-api';

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

function ventasForKind(
  kind: 'ventas_implementation' | 'ventas_post_sales',
  scoped: VentaGanadaRecord[],
): VentaGanadaRecord[] {
  if (kind === 'ventas_implementation') {
    return scoped.filter(
      (v) =>
        v.envioPmo.estado === 'Enviado' && Boolean(v.envioPmo.serConsecutivo),
    );
  }
  return scoped.filter((v) => {
    const sent = v.envioPmo.estado === 'Enviado';
    const csatDone =
      v.csat.valor != null ||
      (v.csat.semanas != null && v.csat.semanas.length > 0);
    return sent && csatDone;
  });
}

function toDetailItem(venta: VentaGanadaRecord): QualificationDashboardDetailItem {
  return {
    entity: 'ouv',
    id: venta.ouvId,
    label: venta.titulo,
    segmento: null,
    estado: venta.envioPmo.estado,
    detail: venta.envioPmo.serConsecutivo
      ? `SER ${venta.envioPmo.serConsecutivo}`
      : venta.consecutivo,
    occurred_at: venta.envioPmo.enviadoEn ?? venta.updatedAt,
    sql_id: null,
  };
}

export function paginateQualificationVentasDetails(
  kind: 'ventas_implementation' | 'ventas_post_sales',
  options: {
    periodFrom?: string;
    periodTo?: string;
    year?: number | null;
    quarter?: number | null;
    periodActive: boolean;
    page: number;
    limit: number;
  },
): { items: QualificationDashboardDetailItem[]; total: number } {
  const ventas = listVentasGanadas();
  const scoped = options.periodActive
    ? filterVentasByPeriod(ventas, options)
    : ventas;
  const filtered = ventasForKind(kind, scoped);
  const total = filtered.length;
  const offset = (options.page - 1) * options.limit;
  const slice = filtered.slice(offset, offset + options.limit);
  return { items: slice.map(toDetailItem), total };
}
