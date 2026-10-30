import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ApiError } from '../../auth/types';
import { FISCAL_QUARTER_OPTIONS } from '../../../components/fiscal-quarter-options';
import {
  deleteMarketingDashboardGoal,
  fetchMarketingDashboardGoals,
  replaceMarketingDashboardGoals,
} from '../api/dashboard-api';
import type { DemandGoalMetric } from '../types';
import { bogotaFiscalYear } from '../lib/bogota-fiscal';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

const METRICS: { metric: DemandGoalMetric; label: string }[] = [
  { metric: 'INTERACTIONS', label: 'Interacciones' },
  { metric: 'LEADS', label: 'Leads del período' },
  { metric: 'CONVERTED_OUV', label: 'Convertidos a OUV' },
];

const WEEKLY_TARGET_MESSAGE =
  'La meta semanal debe ser un entero entre 0 y 2147483647.';
const INCOMPLETE_MESSAGE =
  'Completa las tres metas del trimestre o déjalas vacías.';
const REMOVE_HINT =
  'Para quitar las metas usa "Quitar metas del Q".';
const DISCARD_MESSAGE = 'Hay cambios sin guardar. ¿Cerrar sin guardar?';
const ROUTE_PREFIX = /^(?:[A-Za-z_][\w]*|\d+)\./;

type Draft = Record<DemandGoalMetric, string>;
type Ids = Record<DemandGoalMetric, string | null>;

const EMPTY_DRAFT: Draft = {
  INTERACTIONS: '',
  LEADS: '',
  CONVERTED_OUV: '',
};

const EMPTY_IDS: Ids = {
  INTERACTIONS: null,
  LEADS: null,
  CONVERTED_OUV: null,
};

type Props = {
  initialYear: number;
  initialQuarter: 1 | 2 | 3 | 4;
  onClose: () => void;
  onSaved: () => void;
  onChanged: () => void;
};

function emptyDraft(): Draft {
  return { ...EMPTY_DRAFT };
}

function parseWeekly(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed > 2147483647) return null;
  return parsed;
}

function sameDraft(left: Draft, right: Draft): boolean {
  return METRICS.every((item) => left[item.metric] === right[item.metric]);
}

function stripValidationRoutePrefix(raw: string): string {
  let text = raw.trim();
  while (ROUTE_PREFIX.test(text)) {
    const next = text.replace(ROUTE_PREFIX, '');
    if (!next) break;
    text = next;
  }
  return text;
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.messages && error.messages.length > 0) {
    return error.messages.map(stripValidationRoutePrefix).join('\n');
  }
  if (error.message.trim()) return stripValidationRoutePrefix(error.message);
  return fallback;
}

function hint(weekly: number, quarterDays: number): string {
  const fortnight = weekly * 2;
  const quarterTotal = Math.round((weekly * quarterDays) / 7);
  const format = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
  return `≈ ${format.format(fortnight)} por quincena · ≈ ${format.format(quarterTotal)} en el trimestre`;
}

function yearOptions(selected: number): number[] {
  const current = bogotaFiscalYear();
  const years = new Set<number>([selected]);
  for (let year = current - 2; year <= current + 1; year += 1) {
    years.add(year);
  }
  return [...years].sort((left, right) => right - left);
}

export function MarketingDashboardGoalsModal({
  initialYear,
  initialQuarter,
  onClose,
  onSaved,
  onChanged,
}: Props) {
  const [year, setYear] = useState(initialYear);
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(initialQuarter);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [baseline, setBaseline] = useState<Draft>(emptyDraft);
  const [ids, setIds] = useState<Ids>({ ...EMPTY_IDS });
  const [quarterDays, setQuarterDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = !sameDraft(draft, baseline);
  const hasStored = METRICS.some((item) => ids[item.metric]);
  const allEmpty = METRICS.every((item) => draft[item.metric].trim() === '');
  const mustUseRemove = hasStored && allEmpty;
  const years = yearOptions(year);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMarketingDashboardGoals(year);
      const days =
        response.quarters.find((item) => item.quarter === quarter)?.days ??
        null;
      const nextDraft = emptyDraft();
      const nextIds: Ids = { ...EMPTY_IDS };
      for (const item of response.items) {
        if (item.quarter !== quarter) continue;
        if (!METRICS.some((metric) => metric.metric === item.metric)) continue;
        nextDraft[item.metric] = String(item.weekly_target);
        nextIds[item.metric] = item.target_id;
      }
      setQuarterDays(days);
      setDraft(nextDraft);
      setBaseline(nextDraft);
      setIds(nextIds);
    } catch (loadError) {
      setQuarterDays(null);
      setDraft(emptyDraft());
      setBaseline(emptyDraft());
      setIds({ ...EMPTY_IDS });
      setError(errorMessage(loadError, 'No se pudieron cargar las metas.'));
    } finally {
      setLoading(false);
    }
  }, [quarter, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when the quarter changes
    void loadGoals();
  }, [loadGoals]);

  const confirmDiscard = useCallback(() => {
    if (!dirty || saving) return !saving;
    return window.confirm(DISCARD_MESSAGE);
  }, [dirty, saving]);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (!confirmDiscard()) return;
    onClose();
  }, [confirmDiscard, onClose, saving]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') requestClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  function updateDraft(metric: DemandGoalMetric, value: string) {
    setError(null);
    setDraft((current) => ({ ...current, [metric]: value }));
  }

  function changeYear(value: string) {
    const next = Number(value);
    if (next === year) return;
    if (!confirmDiscard()) return;
    setYear(next);
  }

  function changeQuarter(value: string) {
    const next = Number(value) as 1 | 2 | 3 | 4;
    if (next === quarter) return;
    if (!confirmDiscard()) return;
    setQuarter(next);
  }

  async function handleSave() {
    if (mustUseRemove) return;
    const parsed = METRICS.map((item) => parseWeekly(draft[item.metric]));
    const invalid = METRICS.some(
      (item) =>
        draft[item.metric].trim() !== '' && parseWeekly(draft[item.metric]) === null,
    );
    if (parsed.some((value) => value === null)) {
      setError(invalid ? WEEKLY_TARGET_MESSAGE : INCOMPLETE_MESSAGE);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await replaceMarketingDashboardGoals({
        fiscal_year: year,
        quarter,
        goals: METRICS.map((item, index) => ({
          metric: item.metric,
          weekly_target: parsed[index] as number,
        })),
      });
      onSaved();
    } catch (saveError) {
      setError(errorMessage(saveError, 'No se pudieron guardar las metas.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    const targetIds = METRICS.map((item) => ids[item.metric]).filter(
      (id): id is string => Boolean(id),
    );
    if (targetIds.length === 0 || saving) return;
    const quarterLabel =
      FISCAL_QUARTER_OPTIONS.find((option) => option.value === quarter)?.label ??
      `Q${quarter}`;
    const confirmed = window.confirm(
      `¿Quitar las metas de ${quarterLabel} ${year}? Se eliminan las metas de ese trimestre.`,
    );
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      for (const targetId of targetIds) {
        await deleteMarketingDashboardGoal(targetId);
      }
      onChanged();
      await loadGoals();
    } catch (removeError) {
      const message = errorMessage(
        removeError,
        'No se pudieron quitar las metas.',
      );
      onChanged();
      await loadGoals();
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demand-goals-title"
      onClick={requestClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[43.2rem] flex-col overflow-hidden rounded bg-surface shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 id="demand-goals-title" className="text-sm font-bold text-ink">
              Metas semanales
            </h2>
            <p className="mt-1 text-xs text-muted">
              La meta se define por semana. Quincena y trimestre usan esa misma
              cuenta.
            </p>
          </div>
          <button
            type="button"
            className="icon-btn grid h-9 w-9 shrink-0 place-items-center rounded focus-visible:ring-2 focus-visible:ring-brand"
            aria-label="Cerrar"
            onClick={requestClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="demand-goal-year">
                Año fiscal
              </label>
              <select
                id="demand-goal-year"
                className={inputClass}
                value={year}
                disabled={loading || saving}
                onChange={(event) => changeYear(event.target.value)}
              >
                {years.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="demand-goal-quarter">
                Trimestre
              </label>
              <select
                id="demand-goal-quarter"
                className={inputClass}
                value={quarter}
                disabled={loading || saving}
                onChange={(event) => changeQuarter(event.target.value)}
              >
                {FISCAL_QUARTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            {METRICS.map((item) => {
              const weekly = parseWeekly(draft[item.metric]);
              const help =
                weekly !== null && quarterDays !== null
                  ? hint(weekly, quarterDays)
                  : null;
              return (
                <div key={item.metric}>
                  <p className="text-sm font-bold text-ink">{item.label}</p>
                  <label
                    className={`${labelClass} mt-2`}
                    htmlFor={`demand-goal-${item.metric}`}
                  >
                    Meta semanal
                  </label>
                  <input
                    id={`demand-goal-${item.metric}`}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    className={inputClass}
                    value={draft[item.metric]}
                    disabled={loading || saving}
                    onChange={(event) =>
                      updateDraft(item.metric, event.target.value)
                    }
                  />
                  {help ? (
                    <p className="mt-1 text-xs text-muted">{help}</p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-muted">Cargando metas…</p>
          ) : null}
          {mustUseRemove ? (
            <p className="mt-4 text-sm text-danger">{REMOVE_HINT}</p>
          ) : null}
          {error ? (
            <p className="mt-4 whitespace-pre-line text-sm text-danger">{error}</p>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
          {hasStored ? (
            <button
              type="button"
              className={ghostButtonClass}
              disabled={saving || loading}
              onClick={() => void handleRemove()}
            >
              Quitar metas del Q
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className={ghostButtonClass}
              disabled={saving}
              onClick={requestClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={!dirty || saving || loading || allEmpty}
              onClick={() => void handleSave()}
            >
              Guardar metas
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
