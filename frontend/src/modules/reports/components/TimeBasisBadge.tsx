import { badgeClass } from "../../discovery/components/ui";

export function TimeBasisBadge({ label }: { label: string }) {
  return (
    <span className={`${badgeClass} border border-border bg-bg text-ink`}>
      {label}
    </span>
  );
}
