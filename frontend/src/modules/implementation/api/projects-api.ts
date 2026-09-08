import { apiRequest } from '../../../lib/api/http-client';

/** Agregado que el PMO calcula desde sus filas semana a semana. */
export type ResumenEjecucion = {
  projectedTotal: number;
  actualTotal: number;
  /** Última semana con dato real y la fecha de ese corte. */
  lastWeek: number | null;
  totalWeeks: number;
  lastDate: string | null;
};

/** Alcance cuenta entregables, no semanas. */
export type ResumenAlcance = {
  completed: number;
  total: number;
};

/** One of the four execution indicators calculated by the PMO. */
export type IndicadorEjecucion = {
  deviation: number;
  percentage: number;
  source: string;
  /** Source of truth: with `false` the PMO has no data loaded for this block yet. */
  available: boolean;
  summary?: ResumenEjecucion;
};

export type IndicadorAlcance = Omit<IndicadorEjecucion, 'summary'> & {
  summary?: ResumenAlcance;
};

export type ProyectoEjecucion = {
  ouvId: string;
  /** `PRO_NCODE` del PMO; el backend normaliza el `proyectoId` que envía el PMO. */
  projectId: number;
  name: string | null;
  projectManager: string | null;
  nps: number | null;
  billing: IndicadorEjecucion;
  costs: IndicadorEjecucion;
  schedule: IndicadorEjecucion;
  scope: IndicadorAlcance;
};

export type TransicionEstado = {
  previousState: string | null;
  newState: string;
  occurredAt: string;
};

export type HistorialEstados = {
  ouvId: string;
  projectId: number;
  history: TransicionEstado[];
};

export type TipoProyecto = 'RECURRING' | 'NON_RECURRING';

export type CrearProyectoPmoPayload = {
  fechaInicio: string;
  fechaFin: string;
  nombreProyecto?: string;
  fechaAsignacion?: string;
  tipoProyecto?: TipoProyecto;
  sharepointUrl?: string;
  valorContrato?: number;
  costosEsperados?: number;
};

export type ProyectoPmoCreado = {
  ouvId: string;
  projectId: number;
};

export async function fetchProyectoEjecucion(
  ouvId: string,
): Promise<ProyectoEjecucion> {
  return apiRequest(`/implementation/projects/${ouvId}/execution`);
}

export async function fetchHistorialEstados(
  ouvId: string,
): Promise<HistorialEstados> {
  return apiRequest(`/implementation/projects/${ouvId}/state-history`);
}

export async function crearProyectoPmo(
  ouvId: string,
  payload: CrearProyectoPmoPayload,
): Promise<ProyectoPmoCreado> {
  return apiRequest(`/implementation/projects/${ouvId}`, {
    method: 'POST',
    body: payload,
  });
}
