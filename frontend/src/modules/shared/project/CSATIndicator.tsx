import { useState } from 'react';
import type { CsatRecord } from './types';
import { labelClass, primaryButtonClass } from './ui';

type Props = {
  csat: CsatRecord;
  mode: 'readOnly' | 'editable';
  onSave?: (value: number) => void;
};

/** C2 — CSAT indicator (HU-F03 readOnly, HU-F06 readOnly, HU-F08 editable). */
export function CSATIndicator({ csat, mode, onSave }: Props) {
  const [draft, setDraft] = useState(csat.valor ?? 3);

  if (csat.valor === null && mode === 'readOnly') {
    return (
      <p className="text-sm text-muted">Sin medición disponible</p>
    );
  }

  if (mode === 'readOnly') {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-accent">{csat.valor?.toFixed(1)}</span>
        <span className="text-sm text-muted">/ {csat.escala}</span>
        {csat.fecha ? (
          <span className="text-xs text-muted">
            · {new Date(csat.fecha).toLocaleDateString('es-CO')}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className={labelClass} htmlFor="csat-input">
        Índice CSAT (1–{csat.escala})
      </label>
      <input
        id="csat-input"
        type="range"
        min={1}
        max={csat.escala}
        step={0.1}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        className="w-full accent-accent"
      />
      <p className="text-sm font-bold text-ink">{draft.toFixed(1)} / {csat.escala}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => onSave?.(draft)}
        >
          Guardar puntuación
        </button>
      </div>
      <p className="text-xs text-muted">
        Simulación: el valor se enviará a Control de Proyectos al guardar.
      </p>
    </div>
  );
}
