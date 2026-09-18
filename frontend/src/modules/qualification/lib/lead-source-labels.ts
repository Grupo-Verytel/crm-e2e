import { CANAL_ORIGEN_LABEL } from '../../demand-generation/lib/lead-vocab';
import type { CanalOrigen } from '../../demand-generation/types';

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function formatLeadOrigin(value: unknown): string {
  return asText(value) ?? '—';
}

export function formatLeadSourceChannel(value: unknown): string {
  const channel = asText(value);
  if (!channel) return '—';
  return CANAL_ORIGEN_LABEL[channel as CanalOrigen] ?? channel;
}
