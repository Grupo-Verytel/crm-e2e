import { useEffect, useMemo, useRef } from 'react';

const PIECE_COLORS = [
  'var(--brand-primary)',
  'var(--brand-turquoise)',
  'var(--accent)',
  'var(--success)',
] as const;

type Props = {
  onDone: () => void;
};

const PIECE_COUNT = 210;
const CELEBRATION_MS = 5600;

/**
 * Confetti burst for a Ganada close.
 * Honors prefers-reduced-motion and never captures pointer events.
 */
export function WonCelebration({ onDone }: Props) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => {
        const wave = i < 105 ? 0 : 1;
        return {
          left: `${(i * 17) % 100}%`,
          delay: `${wave * 700 + (i % 18) * 40}ms`,
          duration: `${2400 + (i % 8) * 180}ms`,
          color: PIECE_COLORS[i % PIECE_COLORS.length],
          drift: `${(i % 2 === 0 ? -1 : 1) * (20 + (i % 9) * 14)}px`,
          width: 7 + (i % 4) * 3,
          height: i % 5 === 0 ? 8 + (i % 3) * 3 : 12 + (i % 4) * 3,
          radius: i % 5 === 0 ? '999px' : '1px',
        };
      }),
    [],
  );

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDoneRef.current();
      return;
    }
    const timer = window.setTimeout(() => onDoneRef.current(), CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-55 overflow-hidden"
      aria-hidden
    >
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="won-confetti-piece"
          style={{
            left: piece.left,
            width: piece.width,
            height: piece.height,
            backgroundColor: piece.color,
            borderRadius: piece.radius,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            ['--won-drift' as string]: piece.drift,
          }}
        />
      ))}
    </div>
  );
}
