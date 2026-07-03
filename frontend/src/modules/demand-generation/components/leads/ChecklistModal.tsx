import { useEffect, useState } from 'react';
import {
  fetchChecklist,
  transitionLeadToMql,
  updateChecklist,
} from '../../api/leads-api';
import { invalidateChecklistProgress } from '../../hooks/useChecklistProgress';
import type { UpdateChecklistPayload } from '../../types';
import { ModalShell } from '../ModalShell';
import { ghostButtonClass, primaryButtonClass } from '../ui';

type CriterionKey = keyof UpdateChecklistPayload;

const CRITERIA: { key: CriterionKey; label: string }[] = [
  { key: 'criterio_sector_objetivo', label: '¿Pertenece al sector/industria objetivo?' },
  {
    key: 'criterio_necesidad_portafolio',
    label: '¿Necesidad alineada al portafolio Frisson/Verytel?',
  },
  {
    key: 'criterio_acceso_decisor',
    label: '¿Acceso a decisor o influencia hacia el decisor?',
  },
  {
    key: 'criterio_presupuesto_indicios',
    label: '¿Indicios de presupuesto o capacidad de inversión?',
  },
];

/**
 * Checklist gate for "En nutrición" → "Pendiente de aprobación" (DG-13). Saving
 * the four criteria as true both persists the checklist and promotes the lead;
 * partial progress can be saved without promoting.
 */
export function ChecklistModal({
  leadId,
  leadName,
  onQualified,
  onSaved,
  onClose,
}: {
  leadId: string;
  leadName: string;
  onQualified: () => void | Promise<void>;
  onSaved: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Record<CriterionKey, boolean>>({
    criterio_sector_objetivo: false,
    criterio_necesidad_portafolio: false,
    criterio_acceso_decisor: false,
    criterio_presupuesto_indicios: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchChecklist(leadId)
      .then((checklist) => {
        if (!active || !checklist) {
          return;
        }
        setDraft({
          criterio_sector_objetivo: checklist.criterio_sector_objetivo,
          criterio_necesidad_portafolio: checklist.criterio_necesidad_portafolio,
          criterio_acceso_decisor: checklist.criterio_acceso_decisor,
          criterio_presupuesto_indicios: checklist.criterio_presupuesto_indicios,
        });
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [leadId]);

  const checkedCount = CRITERIA.filter(({ key }) => draft[key]).length;
  const allChecked = checkedCount === CRITERIA.length;

  async function persist(): Promise<void> {
    await updateChecklist(leadId, draft as UpdateChecklistPayload);
    invalidateChecklistProgress(leadId);
  }

  async function handleSaveProgress() {
    setIsSaving(true);
    setError(null);
    try {
      await persist();
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No se pudo guardar el checklist.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleQualify() {
    setIsSaving(true);
    setError(null);
    try {
      await persist();
      await transitionLeadToMql(leadId);
      await onQualified();
      onClose();
    } catch (qualifyError) {
      setError(
        qualifyError instanceof Error
          ? qualifyError.message
          : 'No se pudo enviar a aprobación.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalShell title="Checklist de calificación" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {leadName} — marca los cuatro criterios para enviarlo a aprobación del
          Director.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted">Cargando checklist…</p>
        ) : (
          <ul className="space-y-2">
            {CRITERIA.map(({ key, label }) => (
              <li key={key} className="flex items-start gap-2 text-sm">
                <input
                  id={`cm-${key}`}
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft[key]}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, [key]: event.target.checked }))
                  }
                />
                <label htmlFor={`cm-${key}`} className="text-ink">
                  {label}
                </label>
              </li>
            ))}
          </ul>
        )}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {!allChecked ? (
          <p className="text-xs text-warning">
            Faltan {CRITERIA.length - checkedCount} de {CRITERIA.length} criterios
            para enviar a aprobación.
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleSaveProgress}
            disabled={isSaving || isLoading}
            className={ghostButtonClass}
          >
            Guardar avance
          </button>
          <button
            type="button"
            onClick={handleQualify}
            disabled={isSaving || isLoading || !allChecked}
            className={primaryButtonClass}
          >
            Guardar y enviar a aprobación
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
