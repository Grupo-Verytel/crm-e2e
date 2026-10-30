import type { ReactNode } from "react";
import { cardClass } from "../../discovery/components/ui";
import { InfoNote } from "./InfoNote";
import { TimeBasisBadge } from "./TimeBasisBadge";

export function ReportSection({
  title,
  basis,
  notes,
  children,
}: {
  title: string;
  basis: string;
  notes?: string[];
  children: ReactNode;
}) {
  return (
    <section className={`${cardClass} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        <TimeBasisBadge label={basis} />
        {notes?.map((note) => (
          <InfoNote key={note} text={note} />
        ))}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
