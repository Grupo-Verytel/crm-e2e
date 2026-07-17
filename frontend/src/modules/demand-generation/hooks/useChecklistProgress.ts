import { useEffect, useReducer } from 'react';
import { fetchChecklist } from '../api/leads-api';
import type { Checklist, Lead, LeadEstado } from '../types';

export type ChecklistProgress = { checked: number; total: number };

export const CHECKLIST_TOTAL = 4;

/** Only these states can carry a (partial) checklist worth showing. */
const CHECKLIST_STATES = new Set<LeadEstado>([
  'MOFU',
  'MQL_PENDING',
  'SQL',
  'Reciclaje',
]);

function countChecked(checklist: Checklist): number {
  return [
    checklist.criterio_sector_objetivo,
    checklist.criterio_necesidad_portafolio,
    checklist.criterio_acceso_decisor,
    checklist.criterio_presupuesto_indicios,
  ].filter(Boolean).length;
}

// Module-level cache: checklist progress is stable for a lead within a session,
// so we never refetch the same id and results survive view toggles.
const cache = new Map<string, ChecklistProgress | null>();

export function invalidateChecklistProgress(leadId: string): void {
  cache.delete(leadId);
}

export function needsChecklistProgress(lead: Lead): boolean {
  return (
    CHECKLIST_STATES.has(lead.estado) ||
    (lead.estado === 'TOFU' && lead.canal_origen === 'FABRICA')
  );
}

/**
 * Non-blocking enrichment: the table/board render immediately with the leads,
 * and the "2/4" progress fills in as each checklist resolves. Returns a reader
 * so callers do `progress(lead.lead_id)`.
 */
export function useChecklistProgress(
  leads: Lead[],
): (leadId: string) => ChecklistProgress | null | undefined {
  const [, force] = useReducer((n: number) => n + 1, 0);

  const targetIds = leads
    .filter(needsChecklistProgress)
    .map((lead) => lead.lead_id);
  const key = targetIds.join(',');

  useEffect(() => {
    const missing = targetIds.filter((id) => !cache.has(id));
    if (missing.length === 0) {
      return;
    }

    let active = true;
    void Promise.all(
      missing.map(async (id) => {
        try {
          const checklist = await fetchChecklist(id);
          cache.set(
            id,
            checklist
              ? { checked: countChecked(checklist), total: CHECKLIST_TOTAL }
              : { checked: 0, total: CHECKLIST_TOTAL },
          );
        } catch {
          cache.set(id, null);
        }
      }),
    ).then(() => {
      if (active) {
        force();
      }
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by target ids
  }, [key]);

  return (leadId: string) => cache.get(leadId);
}
