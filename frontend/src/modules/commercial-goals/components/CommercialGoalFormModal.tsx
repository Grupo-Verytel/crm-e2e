import { useMemo, useState } from 'react';
import { ModalShell } from '../../demand-generation/components/ModalShell';
import { commercialOptionLabel } from '../../discovery/api/catalogos-api';
import type { EjecutivoComercialOption } from '../../discovery/api/catalogos-api';
import { parseCopInteger } from '../lib/cop-amount';
import {
  formatBogotaTimestamp,
  formatVerytelQuarterRange,
  isVerytelQuarterFinished,
  verytelQuarterRange,
  type VerytelQuarter,
} from '../lib/verytel-quarter';
import { CopAmountInput } from './CopAmountInput';
import { QuarterSegmentedControl } from './QuarterSegmentedControl';
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './ui';

export type GoalDraft = {
  userId: string;
  fiscalYear: number;
  quarter: VerytelQuarter;
  segmentId: string;
  amountFormatted: string;
};

export type SegmentOption = { id: string; name: string };

type FieldErrors = Partial<Record<'userId' | 'fiscalYear' | 'segmentId' | 'amount', string>>;

type Props = {
  mode: 'create' | 'edit';
  createdAt: string | null;
  commercials: EjecutivoComercialOption[];
  segments: SegmentOption[];
  yearOptions: number[];
  initial: GoalDraft;
  submitting: boolean;
  serverMessage: string | null;
  conflict: { message: string; existingGoalId: string | null } | null;
  onClose: () => void;
  onSubmit: (draft: GoalDraft) => void;
  onEditExisting: () => void;
};

const AMOUNT_ERROR = 'La meta debe ser un entero en pesos, mayor que cero.';
const YEAR_ERROR = 'El año fiscal debe estar entre 2020 y 2100.';

function fieldErrors(draft: GoalDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.userId) errors.userId = 'Elige un comercial.';
  if (draft.fiscalYear < 2020 || draft.fiscalYear > 2100) {
    errors.fiscalYear = YEAR_ERROR;
  }
  if (!draft.segmentId) errors.segmentId = 'Elige un segmento.';
  if (parseCopInteger(draft.amountFormatted) === null) errors.amount = AMOUNT_ERROR;
  return errors;
}

export function CommercialGoalFormModal({
  mode,
  createdAt,
  commercials,
  segments,
  yearOptions,
  initial,
  submitting,
  serverMessage,
  conflict,
  onClose,
  onSubmit,
  onEditExisting,
}: Props) {
  const [draft, setDraft] = useState(initial);
  const [hideConflict, setHideConflict] = useState(false);
  const conflictKey = `${conflict?.existingGoalId ?? ''}:${conflict?.message ?? ''}`;
  const [trackedConflict, setTrackedConflict] = useState(conflictKey);
  if (trackedConflict !== conflictKey) {
    setTrackedConflict(conflictKey);
    setHideConflict(false);
  }
  const errors = useMemo(() => fieldErrors(draft), [draft]);
  const hasErrors = Object.keys(errors).length > 0;
  const range = verytelQuarterRange(draft.fiscalYear, draft.quarter);
  const finished = isVerytelQuarterFinished(range, new Date());
  const visibleConflict = hideConflict ? null : conflict;

  function patch(partial: Partial<GoalDraft>) {
    setHideConflict(true);
    setDraft((current) => ({ ...current, ...partial }));
  }

  return (
    <ModalShell
      title={mode === 'edit' ? 'Editar meta' : 'Nueva meta'}
      onClose={onClose}
    >
      {mode === 'edit' && createdAt ? (
        <p className="-mt-2 mb-4 text-xs text-muted">
          Creada el {formatBogotaTimestamp(createdAt)}
        </p>
      ) : null}
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (submitting || hasErrors) return;
          onSubmit(draft);
        }}
      >
        <div>
          <label className={labelClass} htmlFor="goal-commercial">
            Comercial
          </label>
          <select
            id="goal-commercial"
            className={inputClass}
            value={draft.userId}
            onChange={(event) => patch({ userId: event.target.value })}
          >
            <option value="">Selecciona un comercial</option>
            {commercials.map((commercial) => (
              <option key={commercial.user_id} value={commercial.user_id}>
                {commercialOptionLabel(commercial)}
              </option>
            ))}
          </select>
          {errors.userId ? (
            <p className="mt-1 text-xs text-danger">{errors.userId}</p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="goal-year">
            Año fiscal
          </label>
          <select
            id="goal-year"
            className={inputClass}
            value={draft.fiscalYear}
            onChange={(event) =>
              patch({ fiscalYear: Number(event.target.value) })
            }
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {errors.fiscalYear ? (
            <p className="mt-1 text-xs text-danger">{errors.fiscalYear}</p>
          ) : null}
        </div>

        <div>
          <p id="goal-quarter-label" className={labelClass}>
            Trimestre
          </p>
          <QuarterSegmentedControl
            labelledBy="goal-quarter-label"
            value={draft.quarter}
            onChange={(quarter) => patch({ quarter })}
          />
          <p className="mt-1 text-xs text-muted">
            {formatVerytelQuarterRange(range)}
          </p>
          {finished ? (
            <p className="mt-1 text-xs text-muted">Este trimestre ya terminó.</p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="goal-segment">
            Segmento
          </label>
          <select
            id="goal-segment"
            className={inputClass}
            value={draft.segmentId}
            onChange={(event) => patch({ segmentId: event.target.value })}
          >
            <option value="">Selecciona un segmento</option>
            {segments.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.name}
              </option>
            ))}
          </select>
          {errors.segmentId ? (
            <p className="mt-1 text-xs text-danger">{errors.segmentId}</p>
          ) : null}
        </div>

        <CopAmountInput
          id="goal-amount"
          value={draft.amountFormatted}
          error={errors.amount}
          disabled={submitting}
          onChange={(amountFormatted) => patch({ amountFormatted })}
        />

        {visibleConflict ? (
          <div role="alert" className="rounded border border-danger/40 bg-bg p-3">
            <p className="text-sm text-ink">{visibleConflict.message}</p>
            {visibleConflict.existingGoalId ? (
              <button
                type="button"
                className={`${ghostButtonClass} mt-2`}
                onClick={onEditExisting}
              >
                Editar la meta existente
              </button>
            ) : null}
          </div>
        ) : null}

        {serverMessage ? (
          <p role="alert" className="text-sm text-danger">
            {serverMessage}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={submitting || hasErrors}
          >
            Guardar meta
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
