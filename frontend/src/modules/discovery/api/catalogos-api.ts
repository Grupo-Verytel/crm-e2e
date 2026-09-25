import { apiRequest } from '../../../lib/api/http-client';
import type { OuvZona } from '../lib/ouv-vocab';

export type EjecutivoComercialOption = {
  user_id: string;
  full_name: string;
};

export type MotivoCatalogo = {
  motivo_id: string;
  nombre: string;
  descripcion: string | null;
  requiere_detalle: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
};

export type ZonaChecklistTemplate = {
  template_id: string;
  zona: OuvZona;
  codigo_item: string;
  label: string;
  orden: number;
  created_at: string;
  updated_at: string;
};

export type MotivoPayload = {
  nombre: string;
  descripcion?: string;
  requiere_detalle?: boolean;
  orden?: number;
};

export type TemplatePayload = {
  zona: OuvZona;
  codigo_item: string;
  label: string;
  orden?: number;
};

export async function fetchEjecutivosComerciales(): Promise<
  EjecutivoComercialOption[]
> {
  return apiRequest('/discovery/ouvs/ejecutivos-comerciales');
}

export type ProcessTypeOption = {
  process_type_id: string;
  name: string;
  sort_order: number;
};

export async function fetchProcessTypes(): Promise<ProcessTypeOption[]> {
  return apiRequest('/discovery/process-types');
}

export async function fetchMotivosPerdida(): Promise<MotivoCatalogo[]> {
  return apiRequest('/discovery/motivos-perdida');
}

export async function createMotivoPerdida(
  payload: MotivoPayload,
): Promise<MotivoCatalogo> {
  return apiRequest('/admin/motivos-perdida', { method: 'POST', body: payload });
}

export async function updateMotivoPerdida(
  id: string,
  payload: Partial<MotivoPayload>,
): Promise<MotivoCatalogo> {
  return apiRequest(`/admin/motivos-perdida/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteMotivoPerdida(id: string): Promise<void> {
  return apiRequest(`/admin/motivos-perdida/${id}`, { method: 'DELETE' });
}

export async function fetchMotivosDescarte(): Promise<MotivoCatalogo[]> {
  return apiRequest('/discovery/motivos-descarte');
}

export async function createMotivoDescarte(
  payload: MotivoPayload,
): Promise<MotivoCatalogo> {
  return apiRequest('/admin/motivos-descarte', {
    method: 'POST',
    body: payload,
  });
}

export async function updateMotivoDescarte(
  id: string,
  payload: Partial<MotivoPayload>,
): Promise<MotivoCatalogo> {
  return apiRequest(`/admin/motivos-descarte/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteMotivoDescarte(id: string): Promise<void> {
  return apiRequest(`/admin/motivos-descarte/${id}`, { method: 'DELETE' });
}

export async function fetchZonaChecklistTemplates(): Promise<
  ZonaChecklistTemplate[]
> {
  return apiRequest('/admin/zona-checklist-templates');
}

export async function createZonaChecklistTemplate(
  payload: TemplatePayload,
): Promise<ZonaChecklistTemplate> {
  return apiRequest('/admin/zona-checklist-templates', {
    method: 'POST',
    body: payload,
  });
}

export async function updateZonaChecklistTemplate(
  id: string,
  payload: Partial<TemplatePayload>,
): Promise<ZonaChecklistTemplate> {
  return apiRequest(`/admin/zona-checklist-templates/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteZonaChecklistTemplate(id: string): Promise<void> {
  return apiRequest(`/admin/zona-checklist-templates/${id}`, {
    method: 'DELETE',
  });
}
