import type { VentaGanadaRecord } from '../../shared/project/types';

export function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function parseCopValor(raw: string | null): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

export function parsePctValor(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function parseFractionValor(
  raw: string | null,
): { current: number; total: number } | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  return { current: Number(match[1]), total: Number(match[2]) };
}

export type IndicadorVs = {
  actual: string;
  real: string;
  proyectado: string;
};

export type IndicadorVsKey =
  | 'facturacion'
  | 'costos'
  | 'tiempo'
  | 'alcance'
  | 'documentacion';

/** Real vs proyectado for the five project-control cards. */
export function buildIndicadoresVs(
  record: VentaGanadaRecord,
): Record<IndicadorVsKey, IndicadorVs> {
  const d = record.datosBase;
  const i = record.indicadores;
  const facturado =
    parseCopValor(i.facturacion.valor) ?? Math.round(d.valorFacturar * 0.4);
  const costoPct = parsePctValor(i.costos.valor);
  const costoReal =
    costoPct != null ? Math.round((d.costoEstimado * costoPct) / 100) : null;
  const tiempo = parseFractionValor(i.tiempo.valor);
  const alcancePct = parsePctValor(i.alcance.valor);
  const cdp = parseFractionValor(i.documentacion.valor);

  const tiempoPct =
    tiempo && tiempo.total > 0 ? (tiempo.current / tiempo.total) * 100 : null;

  return {
    facturacion: {
      actual: formatCop(facturado),
      real: formatCop(facturado),
      proyectado: formatCop(d.valorFacturar),
    },
    costos: {
      actual:
        costoReal != null ? formatCop(costoReal) : (i.costos.valor ?? '—'),
      real: costoReal != null ? formatCop(costoReal) : (i.costos.valor ?? '—'),
      proyectado: formatCop(d.costoEstimado),
    },
    tiempo: {
      actual:
        tiempoPct != null ? formatPct(tiempoPct, 1) : (i.tiempo.valor ?? '—'),
      real:
        tiempoPct != null ? formatPct(tiempoPct, 1) : (i.tiempo.valor ?? '—'),
      proyectado: formatPct(100, 0),
    },
    alcance: {
      actual:
        alcancePct != null ? formatPct(alcancePct, 0) : (i.alcance.valor ?? '—'),
      real:
        alcancePct != null ? formatPct(alcancePct, 0) : (i.alcance.valor ?? '—'),
      proyectado: formatPct(100, 0),
    },
    documentacion: {
      actual: cdp ? `${cdp.current} entregables` : (i.documentacion.valor ?? '—'),
      real: cdp ? `${cdp.current} entregables` : (i.documentacion.valor ?? '—'),
      proyectado: cdp ? `${cdp.total} entregables` : '—',
    },
  };
}

export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value.slice(0, 10) || '—';
  }
  return d.toLocaleDateString('es-CO');
}

export function formatIsoDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value || '—';
  }
  return d.toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function toYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isoWeekFromDate(date: Date): string {
  const utc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function isoWeekFromYmd(ymd: string): string {
  const date = parseYmd(ymd);
  return date ? isoWeekFromDate(date) : '';
}

export function currentIsoWeek(): string {
  return isoWeekFromDate(new Date());
}

export function empresaLabel(record: VentaGanadaRecord): string {
  if (record.datosBase.unionesTemporales.length > 0) {
    return record.datosBase.unionesTemporales.map((u) => u.nombre).join(' + ');
  }
  if (record.datosBase.empresasEjecutoras.length > 0) {
    return record.datosBase.empresasEjecutoras.join(' + ');
  }
  return record.empresaNombre || '—';
}

export function csatPercent(record: VentaGanadaRecord): number | null {
  if (record.csat.valor == null || record.csat.escala <= 0) return null;
  return (record.csat.valor / record.csat.escala) * 100;
}
