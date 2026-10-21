import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { ApiError } from '../../auth/types';
import { useAuth } from '../../auth/hooks/useAuth';
import { FloatingToast } from '../../demand-generation/components/FloatingToast';
import { fetchSegments } from '../../demand-generation/api/segments-api';
import {
  commercialOptionLabel,
  fetchEjecutivosComerciales,
  type EjecutivoComercialOption,
} from '../../discovery/api/catalogos-api';
import {
  createCommercialGoal,
  deleteCommercialGoal,
  fetchAllCommercialGoals,
  fetchCommercialGoal,
  fetchCommercialGoals,
  fetchCommercialGoalSummary,
  updateCommercialGoal,
} from '../api/commercial-goals-api';
import { CommercialGoalFormModal, type GoalDraft, type SegmentOption } from '../components/CommercialGoalFormModal';
import {
  QuarterGoalGrid,
  type GoalGridRow,
  type GoalGridSegment,
} from '../components/QuarterGoalGrid';
import { QuarterSummaryCards, type QuarterCardModel } from '../components/QuarterSummaryCards';
import { CommercialGoalsTable } from '../components/CommercialGoalsTable';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';
import { formatCopDisplay, formatCopIntegerInput, parseCopInteger } from '../lib/cop-amount';
import { goalCellKey } from '../lib/goal-cell';
import { hasCommercialGoalPermission } from '../lib/can-read-commercial-goals';
import {
  formatVerytelQuarterRange,
  formatVerytelQuarterTitle,
  verytelQuarterOf,
  verytelQuarterRange,
  type VerytelQuarter,
} from '../lib/verytel-quarter';
import type { CommercialGoal, CommercialGoalSummary } from '../types';

const PAGE_LIMIT = 20;
const QUARTERS: VerytelQuarter[] = [1, 2, 3, 4];
const MANAGER_ROLE = 'Gerente Comercial';

type GoalFilters = {
  userId: string;
  quarter: string;
  segmentId: string;
};

const EMPTY_FILTERS: GoalFilters = { userId: '', quarter: '', segmentId: '' };

function yearOptions(anchor: number, extra?: number): number[] {
  const end = Math.min(2100, Math.max(anchor + 2, extra ?? anchor));
  const years: number[] = [];
  for (let year = 2020; year <= end; year += 1) years.push(year);
  return years;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'No tienes permiso para esta acción.';
    if (error.message.trim()) return error.message;
  }
  return 'No se pudo completar la operación.';
}

function isQuarter(value: number): value is VerytelQuarter {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function CommercialGoalsPage() {
  const { user } = useAuth();
  const allowed = hasCommercialGoalPermission(user, 'read');
  const canCreate = hasCommercialGoalPermission(user, 'create');
  const canUpdate = hasCommercialGoalPermission(user, 'update');
  const canDelete = hasCommercialGoalPermission(user, 'delete');
  const today = useMemo(() => verytelQuarterOf(new Date()), []);
  const [year, setYear] = useState(today.fiscalYear);
  const [draft, setDraft] = useState<GoalFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<GoalFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CommercialGoal[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<CommercialGoalSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commercials, setCommercials] = useState<EjecutivoComercialOption[]>([]);
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalNonce, setModalNonce] = useState(0);
  const [editing, setEditing] = useState<CommercialGoal | null>(null);
  const [createSeed, setCreateSeed] = useState<GoalDraft>({
    userId: '',
    fiscalYear: today.fiscalYear,
    quarter: today.quarter,
    segmentId: '',
    amountFormatted: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    message: string;
    existingGoalId: string | null;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [matrixValues, setMatrixValues] = useState<Record<string, string>>({});
  const [matrixBase, setMatrixBase] = useState<Record<string, string>>({});
  const [matrixIds, setMatrixIds] = useState<Record<string, string>>({});
  const [matrixGoals, setMatrixGoals] = useState<CommercialGoal[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const matrixErrorHold = useRef<string | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 4000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!highlightedId) return;
    const timer = window.setTimeout(() => setHighlightedId(null), 2000);
    return () => window.clearTimeout(timer);
  }, [highlightedId]);

  useEffect(() => {
    if (!allowed) return;
    void fetchEjecutivosComerciales()
      .then((rows) => setCommercials(Array.isArray(rows) ? rows : []))
      .catch(() => setCommercials([]));
    void fetchSegments()
      .then((rows) =>
        setSegments(
          rows.map((segment) => ({ id: segment.id, name: segment.name })),
        ),
      )
      .catch(() => setSegments([]));
  }, [allowed]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [list, nextSummary] = await Promise.all([
        fetchCommercialGoals({
          page,
          limit: PAGE_LIMIT,
          fiscal_year: year,
          ...(applied.quarter ? { quarter: Number(applied.quarter) } : {}),
          ...(applied.userId ? { user_id: applied.userId } : {}),
          ...(applied.segmentId ? { segment_id: applied.segmentId } : {}),
        }),
        fetchCommercialGoalSummary({
          fiscal_year: year,
          ...(applied.userId ? { user_id: applied.userId } : {}),
          ...(applied.segmentId ? { segment_id: applied.segmentId } : {}),
        }),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setSummary(nextSummary);
    } catch (caught) {
      setItems([]);
      setTotal(0);
      setSummary(null);
      setError(messageOf(caught));
    } finally {
      setIsLoading(false);
    }
  }, [applied.quarter, applied.segmentId, applied.userId, page, year]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      if (!cancelled) void load();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [allowed, load, reloadKey]);

  const matrixQuarter = isQuarter(Number(applied.quarter))
    ? (Number(applied.quarter) as VerytelQuarter)
    : null;
  const canWriteMatrix = canCreate || canUpdate;

  const loadMatrix = useCallback(
    async (isCancelled: () => boolean) => {
      if (matrixQuarter == null) return;
      setMatrixLoading(true);
      try {
        const goals = await fetchAllCommercialGoals({
          fiscal_year: year,
          quarter: matrixQuarter,
          ...(applied.userId ? { user_id: applied.userId } : {}),
          ...(applied.segmentId ? { segment_id: applied.segmentId } : {}),
        });
        if (isCancelled()) return;
        const values: Record<string, string> = {};
        const ids: Record<string, string> = {};
        for (const goal of goals) {
          const key = goalCellKey(goal.user_id, goal.segment_id);
          values[key] = formatCopIntegerInput(goal.amount_cop);
          ids[key] = goal.commercial_goal_id;
        }
        setMatrixGoals(goals);
        setMatrixValues(values);
        setMatrixBase(values);
        setMatrixIds(ids);
        setMatrixError(matrixErrorHold.current);
        matrixErrorHold.current = null;
      } catch (caught) {
        if (isCancelled()) return;
        setMatrixGoals([]);
        setMatrixValues({});
        setMatrixBase({});
        setMatrixIds({});
        setMatrixError(matrixErrorHold.current ?? messageOf(caught));
        matrixErrorHold.current = null;
      } finally {
        if (!isCancelled()) setMatrixLoading(false);
      }
    },
    [applied.segmentId, applied.userId, matrixQuarter, year],
  );

  useEffect(() => {
    if (!allowed || matrixQuarter == null || !canWriteMatrix) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      if (!cancelled) void loadMatrix(() => cancelled);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [allowed, canWriteMatrix, loadMatrix, matrixQuarter, reloadKey]);

  const matrixRows = useMemo(() => {
    const byId = new Map<string, GoalGridRow>();
    for (const commercial of commercials) {
      if (applied.userId && commercial.user_id !== applied.userId) continue;
      byId.set(commercial.user_id, {
        userId: commercial.user_id,
        label: commercial.full_name,
        isManager: commercial.role_name === MANAGER_ROLE,
      });
    }
    for (const goal of matrixGoals) {
      if (byId.has(goal.user_id)) continue;
      byId.set(goal.user_id, {
        userId: goal.user_id,
        label: goal.commercial_full_name,
        isManager: goal.commercial_role_name === MANAGER_ROLE,
      });
    }
    return [...byId.values()].sort((left, right) =>
      left.label.localeCompare(right.label, 'es'),
    );
  }, [applied.userId, commercials, matrixGoals]);

  const matrixSegments = useMemo(() => {
    const byId = new Map<string, GoalGridSegment>();
    for (const segment of segments) {
      if (applied.segmentId && segment.id !== applied.segmentId) continue;
      byId.set(segment.id, segment);
    }
    for (const goal of matrixGoals) {
      if (byId.has(goal.segment_id)) continue;
      byId.set(goal.segment_id, {
        id: goal.segment_id,
        name: goal.segment_name,
      });
    }
    return [...byId.values()].sort((left, right) =>
      left.name.localeCompare(right.name, 'es'),
    );
  }, [applied.segmentId, matrixGoals, segments]);

  function onMatrixChange(userId: string, segmentId: string, formatted: string) {
    setMatrixValues((current) => ({
      ...current,
      [goalCellKey(userId, segmentId)]: formatted,
    }));
  }

  function onFillEmpty(formatted: string) {
    if (parseCopInteger(formatted) === null) return;
    setMatrixValues((current) => {
      const next = { ...current };
      for (const row of matrixRows) {
        for (const segment of matrixSegments) {
          const key = goalCellKey(row.userId, segment.id);
          if (next[key]) continue;
          next[key] = formatted;
        }
      }
      return next;
    });
  }

  function onCopyRow(userId: string) {
    setMatrixValues((current) => {
      const next = { ...current };
      let source = '';
      for (const segment of matrixSegments) {
        const value = next[goalCellKey(userId, segment.id)] ?? '';
        if (value) {
          source = value;
          break;
        }
      }
      if (!source) return current;
      for (const segment of matrixSegments) {
        const key = goalCellKey(userId, segment.id);
        if (next[key]) continue;
        next[key] = source;
      }
      return next;
    });
  }

  async function onSaveMatrix() {
    if (matrixQuarter == null) return;
    const keys = new Set([
      ...Object.keys(matrixBase),
      ...Object.keys(matrixValues),
    ]);
    type MatrixOp =
      | { kind: 'create'; userId: string; segmentId: string; amount: number }
      | { kind: 'update'; goalId: string; amount: number }
      | { kind: 'delete'; goalId: string };
    const ops: MatrixOp[] = [];
    for (const key of keys) {
      const next = matrixValues[key] ?? '';
      const previous = matrixBase[key] ?? '';
      if (next === previous) continue;
      const separator = key.indexOf(':');
      const userId = key.slice(0, separator);
      const segmentId = key.slice(separator + 1);
      if (!next) {
        const goalId = matrixIds[key];
        if (goalId) ops.push({ kind: 'delete', goalId });
        continue;
      }
      const amount = parseCopInteger(next);
      if (amount === null) {
        setMatrixError('Hay un valor que no es un entero mayor que 0.');
        return;
      }
      const goalId = matrixIds[key];
      if (goalId) {
        if (!canUpdate) continue;
        ops.push({ kind: 'update', goalId, amount });
      } else if (canCreate) {
        ops.push({ kind: 'create', userId, segmentId, amount });
      }
    }
    if (ops.length === 0) return;
    const deletes = ops.filter((op) => op.kind === 'delete');
    if (deletes.length > 0 && !canDelete) {
      setMatrixError('No tienes permiso para dejar vacía una meta que ya existe.');
      return;
    }
    if (deletes.length > 0) {
      const label =
        deletes.length === 1
          ? '1 meta que quedó vacía'
          : `${deletes.length} metas que quedaron vacías`;
      const confirmed = window.confirm(
        `¿Eliminar ${label}? Esta acción queda registrada en la auditoría.`,
      );
      if (!confirmed) return;
    }
    setMatrixSaving(true);
    setMatrixError(null);
    const failures: string[] = [];
    const run = async (op: MatrixOp) => {
      if (op.kind === 'delete') {
        await deleteCommercialGoal(op.goalId);
        return;
      }
      if (op.kind === 'update') {
        await updateCommercialGoal(op.goalId, { amount_cop: op.amount });
        return;
      }
      try {
        await createCommercialGoal({
          user_id: op.userId,
          fiscal_year: year,
          quarter: matrixQuarter,
          segment_id: op.segmentId,
          amount_cop: op.amount,
        });
      } catch (caught) {
        if (
          caught instanceof ApiError &&
          caught.status === 409 &&
          caught.existingGoalId
        ) {
          await updateCommercialGoal(caught.existingGoalId, {
            amount_cop: op.amount,
          });
          return;
        }
        throw caught;
      }
    };
    for (let index = 0; index < ops.length; index += 6) {
      const chunk = ops.slice(index, index + 6);
      const results = await Promise.allSettled(chunk.map((op) => run(op)));
      for (const result of results) {
        if (result.status === 'rejected') failures.push(messageOf(result.reason));
      }
    }
    setMatrixSaving(false);
    if (failures.length > 0) {
      matrixErrorHold.current =
        failures.length === 1
          ? failures[0]
          : `No se pudieron guardar ${failures.length} celdas. ${failures[0]}`;
    }
    setReloadKey((current) => current + 1);
    if (failures.length === 0) {
      showToast(ops.length === 1 ? 'Meta guardada' : 'Metas guardadas');
    }
  }

  const filtersActive = Boolean(
    applied.userId || applied.quarter || applied.segmentId,
  );
  const years = yearOptions(today.fiscalYear, year);
  const todayRange = verytelQuarterRange(today.fiscalYear, today.quarter);

  const cards: QuarterCardModel[] = QUARTERS.map((quarter) => {
    const row = summary?.quarters.find((item) => item.quarter === quarter);
    return {
      quarter,
      rangeLabel: formatVerytelQuarterRange(verytelQuarterRange(year, quarter)),
      totalLabel: formatCopDisplay(row?.total_amount_cop ?? '0'),
      commercialCount: row?.commercial_count ?? 0,
      isCurrent: today.fiscalYear === year && today.quarter === quarter,
      isSelected: applied.quarter === String(quarter),
    };
  });

  function toggleQuarter(quarter: VerytelQuarter) {
    const next = applied.quarter === String(quarter) ? '' : String(quarter);
    setDraft((current) => ({ ...current, quarter: next }));
    setApplied((current) => ({ ...current, quarter: next }));
    setPage(1);
  }

  function openCreate() {
    const quarter = isQuarter(Number(applied.quarter))
      ? (Number(applied.quarter) as VerytelQuarter)
      : today.quarter;
    setEditing(null);
    setServerMessage(null);
    setConflict(null);
    setModalNonce((current) => current + 1);
    setModalOpen(true);
    setCreateSeed({
      userId: applied.userId,
      fiscalYear: year,
      quarter,
      segmentId: applied.segmentId,
      amountFormatted: '',
    });
  }

  function openEdit(goal: CommercialGoal) {
    const quarter = isQuarter(goal.quarter) ? goal.quarter : today.quarter;
    setEditing(goal);
    setServerMessage(null);
    setConflict(null);
    setModalOpen(true);
    setCreateSeed({
      userId: goal.user_id,
      fiscalYear: goal.fiscal_year,
      quarter,
      segmentId: goal.segment_id,
      amountFormatted: formatCopIntegerInput(goal.amount_cop),
    });
  }

  async function onSubmit(draftValues: GoalDraft) {
    const amount = parseCopInteger(draftValues.amountFormatted);
    if (amount === null) return;
    const body = {
      user_id: draftValues.userId,
      fiscal_year: draftValues.fiscalYear,
      quarter: draftValues.quarter,
      segment_id: draftValues.segmentId,
      amount_cop: amount,
    };
    setSubmitting(true);
    setServerMessage(null);
    setConflict(null);
    try {
      const saved = editing
        ? await updateCommercialGoal(editing.commercial_goal_id, body)
        : await createCommercialGoal(body);
      setModalOpen(false);
      setEditing(null);
      setYear(saved.fiscal_year);
      setPage(1);
      setHighlightedId(saved.commercial_goal_id);
      setReloadKey((current) => current + 1);
      showToast('Meta guardada');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setConflict({
          message: caught.message,
          existingGoalId: caught.existingGoalId ?? null,
        });
        return;
      }
      setServerMessage(messageOf(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function onEditExisting() {
    if (!conflict?.existingGoalId) return;
    setSubmitting(true);
    try {
      const goal = await fetchCommercialGoal(conflict.existingGoalId);
      openEdit(goal);
    } catch (caught) {
      setServerMessage(messageOf(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(goal: CommercialGoal) {
    const quarter = isQuarter(goal.quarter) ? goal.quarter : 1;
    const period = formatVerytelQuarterTitle(goal.fiscal_year, quarter);
    const value = formatCopDisplay(goal.amount_cop);
    const confirmed = window.confirm(
      `¿Eliminar la meta de ${goal.commercial_full_name} para ${period} · ${goal.segment_name} (${value})? Esta acción queda registrada en la auditoría.`,
    );
    if (!confirmed) return;
    try {
      await deleteCommercialGoal(goal.commercial_goal_id);
      showToast('Meta eliminada');
      if (items.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        setReloadKey((current) => current + 1);
      }
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  if (!allowed) {
    return <Navigate to="/opportunities" replace />;
  }

  const modalInitial: GoalDraft = editing
    ? {
        userId: editing.user_id,
        fiscalYear: editing.fiscal_year,
        quarter: isQuarter(editing.quarter) ? editing.quarter : today.quarter,
        segmentId: editing.segment_id,
        amountFormatted: formatCopIntegerInput(editing.amount_cop),
      }
    : createSeed;

  return (
    <AppLayout title="Metas comerciales">
      <Link
        to="/opportunities/dashboard"
        className="mb-3 inline-flex text-sm text-muted hover:text-accent"
      >
        ← Dashboard
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">Metas comerciales</h1>
          <p className="text-sm text-muted">
            Define las metas de cada comercial por trimestre fiscal Verytel.
          </p>
        </div>
        {canCreate ? (
          <button type="button" className={primaryButtonClass} onClick={openCreate}>
            <Plus size={16} aria-hidden />
            Nueva meta
          </button>
        ) : null}
      </div>

      <p className="mb-4 inline-flex rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
        Hoy: {formatVerytelQuarterTitle(today.fiscalYear, today.quarter)} ·{' '}
        {formatVerytelQuarterRange(todayRange)}
      </p>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">Resumen por trimestre</h2>
        <div className="w-36">
          <label className={labelClass} htmlFor="goals-year">
            Año fiscal
          </label>
          <select
            id="goals-year"
            className={inputClass}
            value={year}
            onChange={(event) => {
              setYear(Number(event.target.value));
              setPage(1);
            }}
          >
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <QuarterSummaryCards cards={cards} onToggle={toggleQuarter} />

      {matrixQuarter == null ? (
        <p className="mt-3 text-sm text-muted">
          Selecciona un trimestre para ingresar, de una vez, la meta de cada comercial en cada segmento.
        </p>
      ) : canWriteMatrix ? (
        <QuarterGoalGrid
          title={formatVerytelQuarterTitle(year, matrixQuarter)}
          rangeLabel={formatVerytelQuarterRange(
            verytelQuarterRange(year, matrixQuarter),
          )}
          rows={matrixRows}
          segments={matrixSegments}
          values={matrixValues}
          originals={matrixBase}
          loading={matrixLoading}
          saving={matrixSaving}
          canWrite
          error={matrixError}
          onChange={onMatrixChange}
          onFillEmpty={onFillEmpty}
          onCopyRow={onCopyRow}
          onSave={() => void onSaveMatrix()}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <label className={labelClass} htmlFor="goals-filter-commercial">
            Comercial
          </label>
          <select
            id="goals-filter-commercial"
            className={inputClass}
            value={draft.userId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, userId: event.target.value }))
            }
          >
            <option value="">Todos</option>
            {commercials.map((commercial) => (
              <option key={commercial.user_id} value={commercial.user_id}>
                {commercialOptionLabel(commercial)}
              </option>
            ))}
          </select>
        </div>
        <div className="w-36">
          <label className={labelClass} htmlFor="goals-filter-quarter">
            Trimestre
          </label>
          <select
            id="goals-filter-quarter"
            className={inputClass}
            value={draft.quarter}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                quarter: event.target.value,
              }))
            }
          >
            <option value="">Todos</option>
            {QUARTERS.map((quarter) => (
              <option key={quarter} value={quarter}>
                Q{quarter}
              </option>
            ))}
          </select>
        </div>
        <div className="w-56">
          <label className={labelClass} htmlFor="goals-filter-segment">
            Segmento
          </label>
          <select
            id="goals-filter-segment"
            className={inputClass}
            value={draft.segmentId}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                segmentId: event.target.value,
              }))
            }
          >
            <option value="">Todos</option>
            {segments.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            setApplied(draft);
            setPage(1);
          }}
        >
          Aplicar
        </button>
        <button
          type="button"
          className={ghostButtonClass}
          onClick={() => {
            setDraft(EMPTY_FILTERS);
            setApplied(EMPTY_FILTERS);
            setPage(1);
          }}
        >
          Limpiar
        </button>
      </div>

      <div className="mt-4 rounded bg-surface shadow-card">
        {isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Cargando metas…</p>
        ) : error ? (
          <p className="px-4 py-10 text-center text-sm text-danger" role="alert">
            {error}
          </p>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-ink">
              {filtersActive
                ? 'Ninguna meta coincide con los filtros.'
                : `Aún no hay metas para ${year}.`}
            </p>
            {!filtersActive && canCreate ? (
              <button
                type="button"
                className={`${primaryButtonClass} mt-3`}
                onClick={openCreate}
              >
                Crear la primera meta
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <CommercialGoalsTable
              items={items}
              highlightedId={highlightedId}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onEdit={openEdit}
              onDelete={(goal) => void onDelete(goal)}
            />
            <Pagination
              page={page}
              limit={PAGE_LIMIT}
              total={total}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {modalOpen ? (
        <CommercialGoalFormModal
          key={editing?.commercial_goal_id ?? `create-${modalNonce}`}
          mode={editing ? 'edit' : 'create'}
          createdAt={editing?.created_at ?? null}
          commercials={commercials}
          segments={segments}
          yearOptions={yearOptions(today.fiscalYear, modalInitial.fiscalYear)}
          initial={modalInitial}
          submitting={submitting}
          serverMessage={serverMessage}
          conflict={conflict}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
            setServerMessage(null);
            setConflict(null);
          }}
          onSubmit={(values) => void onSubmit(values)}
          onEditExisting={() => void onEditExisting()}
        />
      ) : null}

      {toast ? <FloatingToast message={toast} onDismiss={() => setToast(null)} /> : null}
    </AppLayout>
  );
}
