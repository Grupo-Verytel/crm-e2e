import { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { updateMarketingDashboardTargets } from '../api/dashboard-api';
import {
  MARKETING_DASHBOARD_PERIOD_LABELS,
  MARKETING_DASHBOARD_PERIOD_TYPES,
  normalizeMarketingDashboardTargets,
  type MarketingDashboardPeriodType,
  type MarketingDashboardTargetRow,
} from '../lib/marketing-dashboard-targets';
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './ui';

type Props = {
  initialTargets: MarketingDashboardTargetRow[];
  onClose: () => void;
  onSaved: (targets: MarketingDashboardTargetRow[]) => void;
};

export function MarketingDashboardTargetsModal({
  initialTargets,
  onClose,
  onSaved,
}: Props) {
  const [draft, setDraft] = useState<MarketingDashboardTargetRow[]>(() =>
    normalizeMarketingDashboardTargets(initialTargets),
  );
  const [expandedPeriod, setExpandedPeriod] =
    useState<MarketingDashboardPeriodType | null>('annual');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function updateRow(
    periodType: MarketingDashboardTargetRow['period_type'],
    field: keyof Omit<MarketingDashboardTargetRow, 'period_type'>,
    value: string,
  ) {
    const parsed = Number(value);
    setDraft((rows) =>
      rows.map((row) =>
        row.period_type === periodType
          ? {
              ...row,
              [field]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
            }
          : row,
      ),
    );
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      const response = await updateMarketingDashboardTargets(
        normalizeMarketingDashboardTargets(draft),
      );
      onSaved(normalizeMarketingDashboardTargets(response.targets));
      onClose();
    } catch {
      setError('No se pudieron guardar las metas.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Metas del dashboard de mercadeo"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[43.2rem] flex-col overflow-hidden rounded bg-surface shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-bold text-ink">Metas del dashboard</h2>
            <p className="mt-1 text-xs text-muted">
              Interacciones, leads del periodo y convertidas a OUV por tipo de
              periodo.
            </p>
          </div>
          <button
            type="button"
            className="icon-btn grid h-8 w-8 shrink-0 place-items-center rounded"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="divide-y divide-border overflow-hidden rounded border border-border bg-bg">
            {MARKETING_DASHBOARD_PERIOD_TYPES.map((periodType) => {
              const row =
                draft.find((item) => item.period_type === periodType) ??
                draft[0];
              const isExpanded = expandedPeriod === periodType;
              const panelId = `target-panel-${periodType}`;
              return (
                <section key={periodType}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/60"
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    onClick={() =>
                      setExpandedPeriod((current) =>
                        current === periodType ? null : periodType,
                      )
                    }
                  >
                    <span className="text-sm font-bold text-ink">
                      {MARKETING_DASHBOARD_PERIOD_LABELS[periodType]}
                    </span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2}
                      className={`shrink-0 text-muted transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden
                    />
                  </button>
                  {isExpanded ? (
                    <div
                      id={panelId}
                      className="grid grid-cols-3 gap-3 border-t border-border px-4 pb-4 pt-3"
                    >
                      <div>
                        <label
                          className={labelClass}
                          htmlFor={`target-${periodType}-interactions`}
                        >
                          Interacciones
                        </label>
                        <input
                          id={`target-${periodType}-interactions`}
                          type="number"
                          min={0}
                          className={inputClass}
                          value={row.interactions}
                          onChange={(event) =>
                            updateRow(
                              periodType,
                              'interactions',
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div>
                        <label
                          className={labelClass}
                          htmlFor={`target-${periodType}-period-leads`}
                        >
                          Leads del periodo
                        </label>
                        <input
                          id={`target-${periodType}-period-leads`}
                          type="number"
                          min={0}
                          className={inputClass}
                          value={row.period_leads}
                          onChange={(event) =>
                            updateRow(
                              periodType,
                              'period_leads',
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div>
                        <label
                          className={labelClass}
                          htmlFor={`target-${periodType}-converted-ouvs`}
                        >
                          Convertidas a OUV
                        </label>
                        <input
                          id={`target-${periodType}-converted-ouvs`}
                          type="number"
                          min={0}
                          className={inputClass}
                          value={row.converted_ouvs}
                          onChange={(event) =>
                            updateRow(
                              periodType,
                              'converted_ouvs',
                              event.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            Guardar metas
          </button>
        </footer>
      </div>
    </div>
  );
}
