type Props = {
  message: string;
  tone?: 'success' | 'error';
  onDismiss?: () => void;
};

/** Floating process toast — does not push page layout. */
export function FloatingToast({
  message,
  tone = 'success',
  onDismiss,
}: Props) {
  const isSuccess = tone === 'success';

  return (
    <div
      role="status"
      className={[
        'toast-fade-in fixed bottom-4 right-4 z-[60] w-[min(24rem,calc(100vw-2rem))] rounded border px-4 py-3 shadow-card',
        isSuccess
          ? 'border-success/40 bg-success text-white'
          : 'border-danger/40 bg-danger text-white',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold">{message}</p>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs text-white/80 hover:text-white"
            aria-label="Cerrar"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}
