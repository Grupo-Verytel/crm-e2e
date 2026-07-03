import { useEffect, useState } from 'react';
import { fetchChecklist, updateChecklist } from '../api/leads-api';
import type { Checklist, UpdateChecklistPayload } from '../types';
import { StatusBadge } from './StatusBadge';
import { cardClass, primaryButtonClass } from './ui';

const CRITERIA: { key: keyof UpdateChecklistPayload; label: string }[] = [
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

export function ChecklistPanel({
  leadId,
  editable,
  onSaved,
}: {
  leadId: string;
  editable: boolean;
  onSaved: () => void;
}) {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchChecklist(leadId).then((data) => {
      if (!active) return;
      setChecklist(data);
      setDraft({
        criterio_sector_objetivo: data?.criterio_sector_objetivo ?? false,
        criterio_necesidad_portafolio: data?.criterio_necesidad_portafolio ?? false,
        criterio_acceso_decisor: data?.criterio_acceso_decisor ?? false,
        criterio_presupuesto_indicios: data?.criterio_presupuesto_indicios ?? false,
      });
    });
    return () => {
      active = false;
    };
  }, [leadId]);

  const allChecked = CRITERIA.every(({ key }) => draft[key]);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      const saved = await updateChecklist(leadId, draft as UpdateChecklistPayload);
      setChecklist(saved);
      onSaved();
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

  return (
    <div className={`${cardClass} p-5`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Checklist de calificación</h2>
        {checklist ? <StatusBadge value={checklist.resultado} /> : null}
      </div>

      <ul className="space-y-2">
        {CRITERIA.map(({ key, label }) => (
          <li key={key} className="flex items-start gap-2 text-sm">
            <input
              id={`chk-${key}`}
              type="checkbox"
              className="mt-0.5"
              checked={draft[key] ?? false}
              disabled={!editable}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, [key]: event.target.checked }))
              }
            />
            <label htmlFor={`chk-${key}`} className="text-ink">
              {label}
            </label>
          </li>
        ))}
      </ul>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {editable ? (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={primaryButtonClass}
          >
            Guardar checklist
          </button>
          {allChecked ? (
            <span className="text-xs text-muted">
              Los 4 criterios cumplen: el lead puede pasar a MQL.
            </span>
          ) : (
            <span className="text-xs text-muted">
              Marca los 4 criterios para habilitar el paso a MQL.
            </span>
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted">
          El checklist es editable únicamente cuando el lead está en MOFU.
        </p>
      )}
    </div>
  );
}
