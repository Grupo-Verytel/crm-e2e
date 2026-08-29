import { DEMO_VENTAS_GANADAS } from './mock-data';
import type { DatosBaseProyecto, VentaGanadaRecord } from './types';

const STORAGE_KEY = 'crm-ventas-ganadas-mock-v2';

function readStore(): Record<string, VentaGanadaRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, VentaGanadaRecord>;
  } catch {
    return {};
  }
}

function writeStore(map: Record<string, VentaGanadaRecord>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** Seed demo records on first load; merges with persisted edits. */
export function initVentaGanadaStore(): void {
  const existing = readStore();
  const merged = { ...existing };
  for (const demo of DEMO_VENTAS_GANADAS) {
    if (!merged[demo.ouvId]) {
      merged[demo.ouvId] = demo;
    }
  }
  writeStore(merged);
}

export function listVentasGanadas(): VentaGanadaRecord[] {
  initVentaGanadaStore();
  return Object.values(readStore()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getVentaGanada(ouvId: string): VentaGanadaRecord | null {
  initVentaGanadaStore();
  return readStore()[ouvId] ?? null;
}

export function upsertVentaGanada(record: VentaGanadaRecord): VentaGanadaRecord {
  const map = readStore();
  const updated = { ...record, updatedAt: new Date().toISOString() };
  map[record.ouvId] = updated;
  writeStore(map);
  return updated;
}

export function mergeApiVentas(records: VentaGanadaRecord[]): void {
  const map = readStore();
  for (const r of records) {
    if (!map[r.ouvId]) {
      map[r.ouvId] = r;
    }
  }
  writeStore(map);
}

export function listProyectosEnImplementacion(): VentaGanadaRecord[] {
  return listVentasGanadas().filter((v) => v.envioPmo.estado === 'Enviado');
}

/** Simulated Control de Proyectos accept — returns CP + SER consecutivos. */
export function mockEnviarAPmo(ouvId: string): VentaGanadaRecord {
  const record = getVentaGanada(ouvId);
  if (!record) {
    throw new Error('Registro no encontrado');
  }

  const seq = String(Math.floor(400 + Math.random() * 100)).padStart(3, '0');
  const cpId = `CP-2026-${seq}`;
  const serSlug = record.consecutivo.replace(/^OUV-\d+-/, '').slice(0, 24);
  const serId = `SER-02${seq}-${serSlug}`;

  const updated: VentaGanadaRecord = {
    ...record,
    envioPmo: {
      estado: 'Enviado',
      consecutivoControlProyectos: cpId,
      serConsecutivo: serId,
      motivo: null,
      enviadoEn: new Date().toISOString(),
    },
    historialEstados: [
      ...record.historialEstados,
      {
        estado: 'Enviada a Control de Proyectos',
        fecha: new Date().toISOString(),
        origen: 'Control de Proyectos (mock)',
      },
      {
        estado: `${serId} creado`,
        fecha: new Date().toISOString(),
        origen: 'Control de Proyectos (mock)',
      },
    ],
    alertas: record.alertas.filter((a) => !a.descripcion.includes('bloqueado')),
  };

  return upsertVentaGanada(updated);
}

export function validateDatosBase(d: DatosBaseProyecto): string[] {
  const missing: string[] = [];
  if (!d.nombreProyecto.trim()) missing.push('Nombre del proyecto');
  if (!d.cliente.trim()) missing.push('Cliente');
  if (!d.fechaInicio) missing.push('Fecha inicio');
  if (!d.fechaFin) missing.push('Fecha fin');
  if (!d.valorFacturar || d.valorFacturar <= 0) missing.push('Valor a facturar');
  if (!d.costoEstimado || d.costoEstimado <= 0) missing.push('Costo estimado');
  if (d.empresasEjecutoras.length === 0) missing.push('Empresa ejecutora');
  const pctSum = d.unionesTemporales.reduce((s, u) => s + u.participacionPct, 0);
  if (pctSum !== 100) missing.push('% participación (debe sumar 100%)');
  return missing;
}

export function allValidacionesAprobadas(record: VentaGanadaRecord): boolean {
  return Object.values(record.validaciones).every((v) => v.estado === 'Aprobado');
}

export function puedeEnviarKickoff(record: VentaGanadaRecord): boolean {
  return allValidacionesAprobadas(record);
}

export function puedeEnviarAPmo(record: VentaGanadaRecord): { ok: boolean; reason: string | null } {
  if (!allValidacionesAprobadas(record)) {
    return { ok: false, reason: 'Hay validaciones pendientes o rechazadas.' };
  }
  if (record.kickoff.estado !== 'Realizado') {
    return { ok: false, reason: 'El kickoff debe estar marcado como Realizado.' };
  }
  if (!record.kickoff.aprobaciones.every((a) => a.completada)) {
    return { ok: false, reason: 'Faltan aprobaciones del kickoff.' };
  }
  const missing = validateDatosBase(record.datosBase);
  if (missing.length > 0) {
    return { ok: false, reason: `Datos incompletos: ${missing.join(', ')}` };
  }
  return { ok: true, reason: null };
}

export function checklistAvancePct(record: VentaGanadaRecord): number {
  let total = 2;
  let done = Object.values(record.validaciones).filter((v) => v.estado === 'Aprobado').length;
  total += 3;
  done += record.kickoff.aprobaciones.filter((a) => a.completada).length;
  if (record.kickoff.estado === 'Realizado') done += 1;
  total += 1;
  const missing = validateDatosBase(record.datosBase);
  total += 6;
  done += 6 - Math.min(missing.length, 6);
  return Math.round((done / total) * 100);
}
