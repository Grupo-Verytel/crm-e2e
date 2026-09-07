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

/**
 * Brief, non-blocking confetti for a Ganada close.
 * Honors prefers-reduced-motion and never captures pointer events.
 */
export function WonCelebration({ onDone }: Props) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const pieces = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        left: `${(i * 23) % 100}%`,
        delay: `${(i % 14) * 50}ms`,
        duration: `${1600 + (i % 6) * 120}ms`,
        color: PIECE_COLORS[i % PIECE_COLORS.length],
        drift: `${(i % 2 === 0 ? -1 : 1) * (12 + (i % 7) * 10)}px`,
        width: 6 + (i % 3) * 2,
        height: 10 + (i % 4) * 2,
      })),
    [],
  );

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDoneRef.current();
      return;
    }
    const timer = window.setTimeout(() => onDoneRef.current(), 2200);
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
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            ['--won-drift' as string]: piece.drift,
          }}
        />
      ))}
    </div>
  );
}
