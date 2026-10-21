import { useMemo, useState } from 'react';
import { abbreviateCop, formatCopIntegerInput, parseCopInteger } from '../lib/cop-amount';
import { goalCellKey } from '../lib/goal-cell';
import { ghostButtonClass, primaryButtonClass } from './ui';

export type GoalGridRow = {
  userId: string;
  label: string;
  isManager: boolean;
};

export type GoalGridSegment = {
  id: string;
  name: string;
};

type Props = {
  title: string;
  rangeLabel: string;
  rows: GoalGridRow[];
  segments: GoalGridSegment[];
  values: Record<string, string>;
  originals: Record<string, string>;
  loading: boolean;
  saving: boolean;
  canWrite: boolean;
  error: string | null;
  onChange: (userId: string, segmentId: string, formatted: string) => void;
  onFillEmpty: (formatted: string) => void;
  onCopyRow: (userId: string) => void;
  onSave: () => void;
};

function changeCount(
  values: Record<string, string>,
  originals: Record<string, string>,
): number {
  const keys = new Set([...Object.keys(values), ...Object.keys(originals)]);
  let count = 0;
  for (const key of keys) {
    if ((values[key] ?? '') !== (originals[key] ?? '')) count += 1;
  }
  return count;
}

export function QuarterGoalGrid({
  title,
  rangeLabel,
  rows,
  segments,
  values,
  originals,
  loading,
  saving,
  canWrite,
  error,
  onChange,
  onFillEmpty,
  onCopyRow,
  onSave,
}: Props) {
  const [stamp, setStamp] = useState('');
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const pending = useMemo(
    () => changeCount(values, originals),
    [originals, values],
  );
  const stampAmount = parseCopInteger(stamp);
  const busy = loading || saving;

  return (
    <section className="mt-4 rounded bg-surface p-4 shadow-card" aria-label="Carga rápida del trimestre">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Carga rápida · {title}</h2>
          <p className="text-xs text-muted">{rangeLabel}</p>
          <p className="mt-1 text-sm text-muted">
            Escribe la meta de cada comercial en cada segmento. Solo se guardan las celdas que cambies.
          </p>
        </div>
        {canWrite ? (
          <button
            type="button"
            className={primaryButtonClass}
            disabled={busy || pending === 0}
            onClick={onSave}
          >
            {saving
              ? 'Guardando…'
              : pending > 0
                ? `Guardar cambios (${pending})`
                : 'Guardar cambios'}
          </button>
        ) : null}
      </div>

      {canWrite && rows.length > 0 && segments.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-ink" htmlFor="goal-grid-stamp">
              Valor para las celdas vacías
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                $
              </span>
              <input
                id="goal-grid-stamp"
                inputMode="numeric"
                autoComplete="off"
                disabled={busy}
                value={stamp}
                onChange={(event) => setStamp(formatCopIntegerInput(event.target.value))}
                className="h-9 w-44 rounded border border-border bg-bg pl-7 pr-3 text-right text-sm tabular-nums text-ink outline-none focus:border-accent focus:bg-surface"
              />
            </div>
          </div>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={busy || stampAmount === null}
            onClick={() => onFillEmpty(stamp)}
          >
            Aplicar a vacías
          </button>
          {stampAmount !== null ? (
            <p className="pb-2 text-xs text-muted">{abbreviateCop(stampAmount)}</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Cargando la grilla…</p>
      ) : rows.length === 0 || segments.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink">
          No hay comerciales o segmentos para armar la grilla.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-48 bg-surface px-2 py-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Comercial
                </th>
                {segments.map((segment) => (
                  <th
                    key={segment.id}
                    className="min-w-36 px-2 py-2 text-xs font-bold text-ink"
                  >
                    {segment.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="align-top">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-surface px-2 py-2 text-left font-bold text-ink"
                  >
                    <span>{row.label}</span>
                    {row.isManager ? (
                      <span className="ml-2 inline-flex rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                        Gerente
                      </span>
                    ) : null}
                    {canWrite ? (
                      <button
                        type="button"
                        className="mt-1 block text-xs font-bold text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
                        disabled={busy}
                        onClick={() => onCopyRow(row.userId)}
                      >
                        Copiar a vacíos
                      </button>
                    ) : null}
                  </th>
                  {segments.map((segment) => {
                    const key = goalCellKey(row.userId, segment.id);
                    const value = values[key] ?? '';
                    const dirty = value !== (originals[key] ?? '');
                    const amount = parseCopInteger(value);
                    const hint = amount === null ? '' : abbreviateCop(amount);
                    const inputId = `goal-cell-${row.userId}-${segment.id}`;
                    return (
                      <td key={segment.id} className="px-2 py-2">
                        <label className="sr-only" htmlFor={inputId}>
                          Meta de {row.label} en {segment.name}
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted">
                            $
                          </span>
                          <input
                            id={inputId}
                            inputMode="numeric"
                            autoComplete="off"
                            disabled={!canWrite || busy}
                            value={value}
                            title={hint || 'Sin meta'}
                            aria-invalid={dirty && value !== '' && amount === null}
                            onFocus={() => setFocusedKey(key)}
                            onBlur={() =>
                              setFocusedKey((current) => (current === key ? null : current))
                            }
                            onChange={(event) =>
                              onChange(
                                row.userId,
                                segment.id,
                                formatCopIntegerInput(event.target.value),
                              )
                            }
                            className={[
                              'h-9 w-full min-w-32 rounded border bg-bg py-1 pl-5 pr-2 text-right text-sm tabular-nums text-ink outline-none focus:bg-surface',
                              dirty ? 'border-accent' : 'border-border',
                            ].join(' ')}
                          />
                        </div>
                        {focusedKey === key && hint ? (
                          <p className="mt-1 text-[11px] text-muted">{hint}</p>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
