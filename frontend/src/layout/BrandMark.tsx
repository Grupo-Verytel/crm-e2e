import { useContext } from 'react';
import frissonMarkDark from '../assets/frisson-mark.png';
import frissonMarkLight from '../assets/frisson-mark-light.png';
import { ThemeContext } from '../theme/theme-context';

type BrandMarkProps = {
  className?: string;
  /** When false, renders only the TF mark (no wordmark). */
  showWordmark?: boolean;
  /** Wordmark color class. Default ink; use text-white on dark panels. */
  wordmarkClassName?: string;
  /**
   * Logo plate variant.
   * - auto: follows app theme (light → dark-ink F bars; dark → white F bars)
   * - dark: orange + white (login / dark panels)
   * - light: orange + ink (light sidebar)
   */
  variant?: 'auto' | 'dark' | 'light';
};

/**
 * Frisson TF mark — geometric brand plate.
 * Icon is never recolored via CSS filters; light/dark plates are separate assets.
 */
export function BrandMark({
  className = '',
  showWordmark = true,
  wordmarkClassName = 'text-[13px] text-ink',
  variant = 'auto',
}: BrandMarkProps) {
  const themeCtx = useContext(ThemeContext);
  const resolved: 'dark' | 'light' =
    variant === 'auto'
      ? themeCtx?.theme === 'dark'
        ? 'dark'
        : 'light'
      : variant;

  const src = resolved === 'dark' ? frissonMarkDark : frissonMarkLight;

  return (
    <span
      className={['inline-flex items-center gap-2.5', className]
        .filter(Boolean)
        .join(' ')}
      aria-label={showWordmark ? undefined : 'Frisson CRM'}
      role={showWordmark ? undefined : 'img'}
    >
      <img
        src={src}
        alt=""
        aria-hidden
        className="block h-full w-auto shrink-0 bg-transparent object-contain object-left"
        draggable={false}
      />
      {showWordmark ? (
        <span className={['font-bold leading-none tracking-tight', wordmarkClassName].join(' ')}>
          Frisson CRM
        </span>
      ) : null}
    </span>
  );
}
