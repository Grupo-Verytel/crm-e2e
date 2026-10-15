import type { CSSProperties } from 'react';

type Props = {
  /** Texto para lectores de pantalla; también se muestra si `showLabel`. */
  label?: string;
  showLabel?: boolean;
  /** Altura de las barras en px (por defecto 50). */
  size?: number;
  className?: string;
};

/** Indicador de carga de la app (cinco barras con los colores de marca). */
export function Loader({
  label = 'Cargando…',
  showLabel = false,
  size,
  className = '',
}: Props) {
  const style = size
    ? ({ '--bars-size': `${size}px` } as CSSProperties)
    : undefined;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`loader-fade-in flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="bars-loader" aria-hidden="true" style={style}>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <span className={showLabel ? 'text-sm text-muted' : 'sr-only'}>
        {label}
      </span>
    </div>
  );
}
