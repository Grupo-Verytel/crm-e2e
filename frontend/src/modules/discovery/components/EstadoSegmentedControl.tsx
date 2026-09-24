import { useRef, type KeyboardEvent } from 'react';
import {
  INFLUENCIA_ESTADO_DOT,
  INFLUENCIA_ESTADO_LABEL,
  INFLUENCIA_ESTADOS,
  type InfluenciaEstado,
} from '../lib/ouv-vocab';

type Props = {
  id?: string;
  value: InfluenciaEstado;
  disabled?: boolean;
  labelledBy?: string;
  compact?: boolean;
  onChange: (estado: InfluenciaEstado) => void;
};

const SELECTED_CLASS: Record<InfluenciaEstado, string> = {
  SinEvaluar: 'bg-muted/16 text-ink',
  Verde: 'bg-estado-verde-fill text-estado-verde-fg',
  Rojo: 'bg-estado-rojo-fill text-estado-rojo-fg',
};

export function EstadoSegmentedControl({
  id,
  value,
  disabled = false,
  labelledBy,
  compact = false,
  onChange,
}: Props) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function moveSelection(fromIndex: number, delta: number) {
    const next =
      (fromIndex + delta + INFLUENCIA_ESTADOS.length) %
      INFLUENCIA_ESTADOS.length;
    const estado = INFLUENCIA_ESTADOS[next];
    onChange(estado);
    buttonRefs.current[next]?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (disabled) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(index, 1);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(index, -1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      onChange(INFLUENCIA_ESTADOS[0]);
      buttonRefs.current[0]?.focus();
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      const last = INFLUENCIA_ESTADOS.length - 1;
      onChange(INFLUENCIA_ESTADOS[last]);
      buttonRefs.current[last]?.focus();
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={`inline-flex rounded border border-border bg-bg ${compact ? 'p-0.5' : 'p-1'}`}
    >
      {INFLUENCIA_ESTADOS.map((estado, index) => {
        const selected = value === estado;
        return (
          <button
            key={estado}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={INFLUENCIA_ESTADO_LABEL[estado]}
            disabled={disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(estado)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={[
              compact
                ? 'inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs outline-none'
                : 'inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm outline-none',
              'transition-colors duration-150',
              'focus-visible:ring-2 focus-visible:ring-accent',
              'disabled:cursor-not-allowed disabled:opacity-40',
              selected ? SELECTED_CLASS[estado] : 'bg-transparent text-muted',
            ].join(' ')}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${INFLUENCIA_ESTADO_DOT[estado]}`}
              aria-hidden
            />
            {INFLUENCIA_ESTADO_LABEL[estado]}
          </button>
        );
      })}
    </div>
  );
}
