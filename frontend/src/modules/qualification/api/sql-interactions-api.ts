import { apiRequest } from '../../../lib/api/http-client';
import type {
  CreateInteractionPayload,
  Interaction,
} from '../../demand-generation/types';

export function fetchSqlInteractions(sqlId: string): Promise<Interaction[]> {
  return apiRequest<Interaction[]>(`/qualification/sqls/${sqlId}/interactions`);
}

export function registerSqlInteraction(
  sqlId: string,
  payload: CreateInteractionPayload,
): Promise<Interaction> {
  return apiRequest<Interaction>(`/qualification/sqls/${sqlId}/interactions`, {
    method: 'POST',
    body: payload,
  });
}
