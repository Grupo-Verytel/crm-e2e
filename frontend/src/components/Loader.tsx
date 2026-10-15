import type { CSSProperties } from 'react';

type Props = {
  /** Texto para lectores de pantalla; también se muestra si `showLabel`. */
  label?: string;
  showLabel?: boolean;
  /** Tamaño del loader en px (por defecto 35). */
  size?: number;
  className?: string;
};

/** Indicador de carga de la app (tres esferas con los colores de marca). */
export function Loader({
  label = 'Cargando…',
  showLabel = false,
  size,
  className = '',
}: Props) {
  const style = size
    ? ({ '--uib-size': `${size}px` } as CSSProperties)
    : undefined;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="three-body" aria-hidden="true" style={style}>
        <div className="three-body__dot" />
        <div className="three-body__dot" />
        <div className="three-body__dot" />
      </div>
      <span className={showLabel ? 'text-sm text-muted' : 'sr-only'}>
        {label}
      </span>
    </div>
  );
}
