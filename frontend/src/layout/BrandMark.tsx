import frissonMark from '../assets/frisson-mark.png';

type BrandMarkProps = {
  className?: string;
  /** When false, renders only the TF mark (no wordmark). */
  showWordmark?: boolean;
};

/**
 * Frisson TF mark — original orange + charcoal colors, transparent plate.
 * Wordmark is always ink (black); the icon is never recolored.
 */
export function BrandMark({
  className = '',
  showWordmark = true,
}: BrandMarkProps) {
  return (
    <span
      className={['inline-flex items-center gap-2.5', className]
        .filter(Boolean)
        .join(' ')}
      aria-label={showWordmark ? undefined : 'Frisson CRM'}
      role={showWordmark ? undefined : 'img'}
    >
      <img
        src={frissonMark}
        alt=""
        aria-hidden
        className="block h-full w-auto shrink-0 bg-transparent object-contain object-left"
        draggable={false}
      />
      {showWordmark ? (
        <span className="text-[13px] font-bold leading-none tracking-tight text-ink">
          Frisson CRM
        </span>
      ) : null}
    </span>
  );
}
