import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import type {
  InfluenciaTipo,
  OuvResultado,
  OuvZona,
} from '../lib/ouv-vocab';

export type Ouv = {
  ouv_id: string;
  consecutivo: string;
  sql_id_origen: string | null;
  origen_via: string;
  comercial_id: string;
  titulo: string;
  empresa_nombre: string;
  descripcion: string | null;
  segmento: string;
  vertical: string;
  zona_actual: OuvZona;
  resultado: OuvResultado;
  tiene_gap: boolean;
  criterios_faltantes: string[] | null;
  presupuesto_confirmado: boolean;
  presupuesto_monto: string | null;
  presupuesto_moneda: string | null;
  presupuesto_fecha_captura: string | null;
  presupuesto_fuente: string | null;
  motivo_id: string | null;
  motivo_snapshot: string | null;
  motivo_detalle: string | null;
  competidor_ganador: string | null;
  monto_final: string | null;
  moneda_final: string | null;
  monto_estimado_perdido: string | null;
  fecha_cierre: string | null;
  created_at: string;
  updated_at: string;
};

export type PaginatedOuvs = {
  items: Ouv[];
  total: number;
  page: number;
  limit: number;
};

export type OuvsQuery = {
  page?: number;
  limit?: number;
  zona?: OuvZona;
  resultado?: OuvResultado;
  tiene_gap?: boolean;
  q?: string;
  created_from?: string;
  created_to?: string;
  all?: boolean;
};

export type OuvContacto = {
  contacto_ouv_id: string;
  ouv_id: string;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

export type OuvInfluencia = {
  influencia_id: string;
  ouv_id: string;
  tipo: InfluenciaTipo;
  estado: string;
  contacto_ouv_id: string | null;
  notas: string | null;
  motivo_estado: string | null;
  fecha_ultimo_cambio: string | null;
  created_at: string;
};

export type OuvChecklistItem = {
  item_id: string;
  ouv_id: string;
  zona: OuvZona;
  codigo_item: string;
  label: string;
  marcado: boolean;
  marcado_at: string | null;
  marcado_por: string | null;
  created_at: string;
};

export type CrearOuvDirectaPayload = {
  titulo: string;
  empresa_nombre: string;
  segmento: string;
  vertical: string;
  descripcion: string;
};

export type ContactoPayload = {
  nombre: string;
  cargo?: string;
  email?: string;
  telefono?: string;
  notas?: string;
};

export async function fetchOuvs(query: OuvsQuery): Promise<PaginatedOuvs> {
  return apiRequest(`/discovery/ouvs${buildQueryString(query)}`);
}

export async function fetchOuv(id: string): Promise<Ouv> {
  return apiRequest(`/discovery/ouvs/${id}`);
}

export async function crearOuvDirecta(
  payload: CrearOuvDirectaPayload,
): Promise<Ouv> {
  return apiRequest('/discovery/ouvs', { method: 'POST', body: payload });
}

export async function avanzarOuv(id: string): Promise<Ouv> {
  return apiRequest(`/discovery/ouvs/${id}/avanzar`, {
    method: 'POST',
    body: {},
  });
}

export async function retrocederOuv(id: string, motivo: string): Promise<Ouv> {
  return apiRequest(`/discovery/ouvs/${id}/retroceder`, {
    method: 'POST',
    body: { motivo },
  });
}

export async function fetchOuvContactos(ouvId: string): Promise<OuvContacto[]> {
  return apiRequest(`/discovery/ouvs/${ouvId}/contactos`);
}

export async function createOuvContacto(
  ouvId: string,
  payload: ContactoPayload,
): Promise<OuvContacto> {
  return apiRequest(`/discovery/ouvs/${ouvId}/contactos`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateOuvContacto(
  ouvId: string,
  contactoOuvId: string,
  payload: Partial<ContactoPayload>,
): Promise<OuvContacto> {
  return apiRequest(`/discovery/ouvs/${ouvId}/contactos/${contactoOuvId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteOuvContacto(
  ouvId: string,
  contactoOuvId: string,
): Promise<void> {
  return apiRequest(`/discovery/ouvs/${ouvId}/contactos/${contactoOuvId}`, {
    method: 'DELETE',
  });
}

export async function fetchOuvInfluencias(
  ouvId: string,
): Promise<OuvInfluencia[]> {
  return apiRequest(`/discovery/ouvs/${ouvId}/influencias`);
}

export async function updateOuvInfluencia(
  ouvId: string,
  tipo: InfluenciaTipo,
  payload: {
    estado: string;
    contacto_ouv_id?: string | null;
    motivo_estado?: string | null;
    notas?: string | null;
  },
): Promise<OuvInfluencia> {
  return apiRequest(`/discovery/ouvs/${ouvId}/influencias/${tipo}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function fetchOuvChecklist(
  ouvId: string,
  zona: OuvZona,
): Promise<OuvChecklistItem[]> {
  return apiRequest(
    `/discovery/ouvs/${ouvId}/checklist${buildQueryString({ zona })}`,
  );
}

export async function marcarChecklistItem(
  ouvId: string,
  itemId: string,
  marcado: boolean,
): Promise<OuvChecklistItem> {
  return apiRequest(`/discovery/ouvs/${ouvId}/checklist/${itemId}`, {
    method: 'PATCH',
    body: { marcado },
  });
}

export async function updateOuvPresupuesto(
  ouvId: string,
  payload: {
    presupuesto_confirmado: boolean;
    presupuesto_monto?: number | null;
    presupuesto_moneda?: string | null;
    presupuesto_fecha_captura?: string | null;
    presupuesto_fuente?: string | null;
  },
): Promise<Ouv> {
  return apiRequest(`/discovery/ouvs/${ouvId}/presupuesto`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function ganarOuv(
  id: string,
  payload: {
    motivo_id?: string;
    motivo_detalle?: string;
    monto_final: number;
    moneda_final: string;
  },
): Promise<Ouv> {
  return apiRequest(`/discovery/ouvs/${id}/ganar`, {
    method: 'POST',
    body: payload,
  });
}

export async function perderOuv(
  id: string,
  payload: {
    motivo_id: string;
    motivo_detalle?: string;
    monto_estimado_perdido: number;
    competidor_ganador?: string;
  },
): Promise<Ouv> {
  return apiRequest(`/discovery/ouvs/${id}/perder`, {
    method: 'POST',
    body: payload,
  });
}

export async function descartarOuv(
  id: string,
  payload: { motivo_id: string; motivo_detalle?: string },
): Promise<Ouv> {
  return apiRequest(`/discovery/ouvs/${id}/descartar`, {
    method: 'POST',
    body: payload,
  });
}
