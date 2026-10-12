import { apiRequest } from '../../../lib/api/http-client';
import type {
  CreateSqlInteractionPayload,
  SqlInteraction,
} from '../types/sql-interaction.types';

export async function fetchSqlInteractions(
  sqlId: string,
): Promise<SqlInteraction[]> {
  return apiRequest<SqlInteraction[]>(
    `/qualification/sqls/${sqlId}/interactions`,
  );
}

export async function registerSqlInteraction(
  sqlId: string,
  payload: CreateSqlInteractionPayload,
): Promise<SqlInteraction> {
  return apiRequest<SqlInteraction>(
    `/qualification/sqls/${sqlId}/interactions`,
    {
      method: 'POST',
      body: payload,
    },
  );
}

export async function deleteSqlInteraction(
  sqlId: string,
  interactionId: string,
): Promise<void> {
  await apiRequest(
    `/qualification/sqls/${sqlId}/interactions/${interactionId}`,
    { method: 'DELETE' },
  );
}
