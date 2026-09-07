import { DEMO_VENTAS_GANADAS, createEmptyKickoff } from './mock-data';
import type {
  DatosBaseProyecto,
  EmpresaEjecutora,
  MiembroEjecutor,
  VentaGanadaRecord,
} from './types';

const STORAGE_KEY = 'crm-ventas-ganadas-mock-v2';
const CLEAR_PRUEBAS_FLAG = 'crm-ventas-ganadas-clear-kickoff-pruebas-v1';

/**
 * Los registros guardados antes de que `MiembroEjecutor` tuviera `id`/`empresa`
 * siguen en localStorage sin esos campos. Se completan al leer, para que una
 * edición vieja no rompa la tabla de empresas ejecutoras.
 */
function normalizeMiembros(record: VentaGanadaRecord): VentaGanadaRecord {
  const miembros = record.datosBase?.unionesTemporales;
  if (!Array.isArray(miembros)) return record;

  const inferirEmpresa = (nombre: string): EmpresaEjecutora | null => {
    if (/frisson/i.test(nombre)) return 'Frisson';
    if (/verytel/i.test(nombre)) return 'Verytel';
    if (/^ut\b|uni[oó]n temporal/i.test(nombre)) return 'UT';
    return null;
  };

  return {
    ...record,
    datosBase: {
      ...record.datosBase,
      unionesTemporales: miembros.map((m, i) => ({
        id: m.id ?? `me-legacy-${record.ouvId}-${i}`,
        nombre: m.nombre,
        participacionPct: m.participacionPct,
        empresa: m.empresa ?? inferirEmpresa(m.nombre),
      })) as MiembroEjecutor[],
    },
  };
}

/**
 * El kickoff ya no vive aquí: apunta a un evento real de Microsoft 365, así
 * que su verdad está en el backend (`offer-closing/ouvs/:ouvId/kickoff`) y
 * debe ser la misma para todos los usuarios. Se vacía al entrar y al salir del
 * almacenamiento local para que un registro viejo no lo resucite.
 */
function withoutKickoff(record: VentaGanadaRecord): VentaGanadaRecord {
  return { ...record, kickoff: createEmptyKickoff() };
}

function readStore(): Record<string, VentaGanadaRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as Record<string, VentaGanadaRecord>;
    return Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, withoutKickoff(normalizeMiembros(v))]),
    );
  } catch {
    return {};
  }
}

function writeStore(map: Record<string, VentaGanadaRecord>): void {
  const sinKickoff = Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k, withoutKickoff(v)]),
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sinKickoff));
}

function isKickoffPruebas(record: VentaGanadaRecord): boolean {
  const nombre =
    record.kickoff.agenda?.nombreReunion?.trim() ||
    record.kickoff.sesionNombre.trim();
  return nombre === 'Pruebas';
}

/** One-shot: remove demo "Pruebas" kickoff so scheduling stages can be retested. */
function clearPruebasKickoffOnce(map: Record<string, VentaGanadaRecord>): void {
  if (localStorage.getItem(CLEAR_PRUEBAS_FLAG)) return;
  let changed = false;
  for (const ouvId of Object.keys(map)) {
    if (!isKickoffPruebas(map[ouvId])) continue;
    map[ouvId] = {
      ...map[ouvId],
      kickoff: createEmptyKickoff(),
      updatedAt: new Date().toISOString(),
    };
    changed = true;
  }
  localStorage.setItem(CLEAR_PRUEBAS_FLAG, '1');
  if (changed) writeStore(map);
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
  clearPruebasKickoffOnce(merged);
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
  if (!record.kickoff.validadoTeams) {
    return {
      ok: false,
      reason: 'Pendiente validar asistencia del kickoff en Teams.',
    };
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
