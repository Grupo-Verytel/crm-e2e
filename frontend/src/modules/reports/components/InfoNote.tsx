import { Info } from "lucide-react";

/** Native tooltip plus an accessible name. The note is not repeated as body copy. */
export function InfoNote({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      title={text}
      aria-label={text}
    >
      <Info size={14} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
