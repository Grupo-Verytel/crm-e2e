import { apiRequest } from '../../../lib/api/http-client';

/** One of the four execution indicators calculated by the PMO. */
export type IndicadorEjecucion = {
  deviation: number;
  percentage: number;
  source: string;
  /** Source of truth: with `false` the PMO has no data loaded for this block yet. */
  available: boolean;
};

export type ProyectoEjecucion = {
  ouvId: string;
  projectId: number;
  billing: IndicadorEjecucion;
  costs: IndicadorEjecucion;
  schedule: IndicadorEjecucion;
  scope: IndicadorEjecucion;
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
