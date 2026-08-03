import { useEffect } from 'react';

/**
 * Tracks pointer over Oriole button classes and writes --glow-x / --glow-y
 * so the 10% white radial follows the mouse direction.
 */
export function PointerGlow() {
  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest<HTMLElement>('.btn-glow, .btn-glow-outline');
      if (!button) {
        return;
      }
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      button.style.setProperty('--glow-x', `${x}px`);
      button.style.setProperty('--glow-y', `${y}px`);
    }

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => document.removeEventListener('pointermove', onPointerMove);
  }, []);

  return null;
}
