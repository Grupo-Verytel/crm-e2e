import { API_BASE, apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';
import { getAccessToken } from '../../../lib/api/token-storage';
import { ApiError } from '../../auth/types';
import type {
  BulkImportJobAccepted,
  BulkImportJobStatus,
  Checklist,
  CreateInteractionPayload,
  CreateLeadPayload,
  Interaction,
  Lead,
  LeadsQuery,
  PaginatedLeads,
  UpdateChecklistPayload,
} from '../types';

export async function fetchLeads(query: LeadsQuery = {}): Promise<PaginatedLeads> {
  return apiRequest<PaginatedLeads>(`/leads${buildQueryString(query)}`);
}

export async function fetchLead(leadId: string): Promise<Lead> {
  return apiRequest<Lead>(`/leads/${leadId}`);
}

export async function createLead(payload: CreateLeadPayload): Promise<Lead> {
  return apiRequest<Lead>('/leads', { method: 'POST', body: payload });
}

export async function updateLead(
  leadId: string,
  payload: Partial<CreateLeadPayload>,
): Promise<Lead> {
  return apiRequest<Lead>(`/leads/${leadId}`, { method: 'PUT', body: payload });
}

export async function reassignLead(
  leadId: string,
  responsableId: string,
): Promise<Lead> {
  return updateLead(leadId, { responsable_id: responsableId });
}

export async function fetchInteractions(
  leadId: string,
): Promise<Interaction[]> {
  return apiRequest<Interaction[]>(`/leads/${leadId}/interactions`);
}

export async function registerInteraction(
  leadId: string,
  payload: CreateInteractionPayload,
): Promise<Interaction> {
  return apiRequest<Interaction>(`/leads/${leadId}/interactions`, {
    method: 'POST',
    body: payload,
  });
}

export async function fetchChecklist(
  leadId: string,
): Promise<Checklist | null> {
  return apiRequest<Checklist | null>(`/leads/${leadId}/checklist`);
}

export async function updateChecklist(
  leadId: string,
  payload: UpdateChecklistPayload,
): Promise<Checklist> {
  return apiRequest<Checklist>(`/leads/${leadId}/checklist`, {
    method: 'PUT',
    body: payload,
  });
}

export async function transitionLeadToMofu(leadId: string): Promise<Lead> {
  return apiRequest<Lead>(`/leads/${leadId}/transition-to-mofu`, {
    method: 'POST',
    body: {},
  });
}

export async function transitionLeadToMql(leadId: string): Promise<Lead> {
  return apiRequest<Lead>(`/leads/${leadId}/transition-to-mql`, {
    method: 'POST',
    body: {},
  });
}

export async function discardLead(
  leadId: string,
  motivo: string,
): Promise<Lead> {
  return apiRequest<Lead>(`/leads/${leadId}/discard`, {
    method: 'POST',
    body: { motivo },
  });
}

export async function recycleLead(
  leadId: string,
  responsableId: string,
): Promise<Lead> {
  return apiRequest<Lead>(`/leads/${leadId}/recycle`, {
    method: 'POST',
    body: { responsable_id: responsableId },
  });
}

export async function enqueueLeadImport(
  file: File,
): Promise<BulkImportJobAccepted> {
  const token = getAccessToken();
  if (!token) {
    throw new ApiError(401, 'Session expired');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/leads/bulk-import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError(response.status, 'No se pudo iniciar la importación');
  }

  return (await response.json()) as BulkImportJobAccepted;
}

export async function fetchImportStatus(
  jobId: string,
): Promise<BulkImportJobStatus> {
  return apiRequest<BulkImportJobStatus>(`/leads/bulk-import/${jobId}`);
}
