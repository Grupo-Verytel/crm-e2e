import { useEffect, useMemo, useRef } from 'react';
import {
  weekDayLabels,
  bogotaSlotFromGrid,
  formatBogota,
  type BusyBlock,
} from '../lib/cita-scheduling';
import { cardClass } from './ui';

const BASE_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

const TONE_CLASS: Record<BusyBlock['tone'], string> = {
  busy: 'bg-muted/35 text-ink',
  provisional: 'border-l-2 border-dashed border-muted bg-bg text-muted',
  proposed: 'border border-accent bg-accent text-white',
};

type Props = {
  weekAnchor: Date;
  blocks: BusyBlock[];
  proposedStart: Date | null;
  proposedEnd: Date | null;
  loading?: boolean;
  error?: string | null;
  onSelectSlot?: (start: Date, end: Date) => void;
};

function bogotaHour(date: Date): number {
  return Number(formatBogota(date).hora.slice(0, 2));
}

function bogotaMinute(date: Date): number {
  return Number(formatBogota(date).hora.slice(3, 5));
}

function hoursCovering(proposedStart: Date | null, proposedEnd: Date | null): number[] {
  let minH = 8;
  let maxH = 18;
  if (proposedStart) minH = Math.min(minH, bogotaHour(proposedStart));
  if (proposedEnd) {
    const endH =
      bogotaMinute(proposedEnd) > 0
        ? bogotaHour(proposedEnd)
        : Math.max(bogotaHour(proposedEnd) - 1, proposedStart ? bogotaHour(proposedStart) : 8);
    maxH = Math.max(maxH, endH);
  }
  const hours: number[] = [];
  for (let h = Math.max(6, minH); h <= Math.min(22, maxH); h += 1) {
    hours.push(h);
  }
  return hours.length > 0 ? hours : BASE_HOURS;
}

function cellCoversProposed(
  dayIndex: number,
  hour: number,
  proposed: BusyBlock | undefined,
): boolean {
  if (!proposed || proposed.dayIndex !== dayIndex) return false;
  return proposed.startHour < hour + 1 && proposed.endHour > hour;
}

export function CitaAvailabilityGrid({
  weekAnchor,
  blocks,
  proposedStart,
  proposedEnd,
  loading = false,
  error = null,
  onSelectSlot,
}: Props) {
  const dayLabels = weekDayLabels(weekAnchor);
  const hours = useMemo(
    () => hoursCovering(proposedStart, proposedEnd),
    [proposedStart, proposedEnd],
  );
  const proposed = blocks.find((b) => b.tone === 'proposed');
  const proposedRef = useRef<HTMLButtonElement>(null);
  const proposedStartMs = proposedStart?.getTime() ?? null;
  const proposedEndMs = proposedEnd?.getTime() ?? null;

  useEffect(() => {
    proposedRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }, [proposedStartMs, proposedEndMs]);

  function blocksAt(dayIndex: number, hour: number): BusyBlock[] {
    return blocks.filter(
      (b) =>
        b.tone !== 'proposed' &&
        b.dayIndex === dayIndex &&
        b.startHour < hour + 1 &&
        b.endHour > hour,
    );
  }

  function handleCellClick(dayIndex: number, hour: number) {
    if (!onSelectSlot) return;
    const durationMinutes =
      proposedStart && proposedEnd
        ? Math.max(
            Math.round(
              (proposedEnd.getTime() - proposedStart.getTime()) / 60_000,
            ),
            30,
          )
        : 60;
    const { start, end } = bogotaSlotFromGrid(
      weekAnchor,
      dayIndex,
      hour,
      durationMinutes,
    );
    onSelectSlot(start, end);
  }

  const proposedLabel =
    proposedStart && proposedEnd
      ? `${proposedStart.toLocaleString('es-CO', {
          timeZone: 'America/Bogota',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })} – ${proposedEnd.toLocaleTimeString('es-CO', {
          timeZone: 'America/Bogota',
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : null;

  return (
    <div className={`${cardClass} overflow-x-auto p-3`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-muted">
            Disponibilidad del comercial (lun–vie)
          </p>
          <p className="mt-1 text-xs text-muted">
            {loading
              ? 'Consultando el calendario en Microsoft 365…'
              : 'Haz clic en una celda libre para fijar la cita.'}
          </p>
        </div>
        {proposedLabel ? (
          <div className="rounded border border-accent bg-accent/15 px-3 py-2 text-xs font-bold text-accent">
            Cita: {proposedLabel}
          </div>
        ) : (
          <div className="rounded border border-border bg-bg px-3 py-2 text-xs text-muted">
            Define fecha y hora o elige un hueco en la grilla.
          </div>
        )}
      </div>

      {error ? (
        <p
          className="mb-3 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className={`min-w-[720px] ${loading ? 'opacity-60' : ''}`}>
        <div className="grid grid-cols-[3rem_repeat(5,1fr)] gap-px bg-border text-xs">
          <div className="bg-surface p-2" />
          {dayLabels.map((label, dayIndex) => (
            <div
              key={label}
              className={[
                'bg-surface p-2 text-center font-bold text-ink',
                proposed?.dayIndex === dayIndex ? 'text-accent' : '',
              ].join(' ')}
            >
              {label}
            </div>
          ))}
          {hours.map((hour) => (
            <div key={hour} className="contents">
              <div className="bg-surface px-1 py-3 text-right text-muted">
                {hour}:00
              </div>
              {dayLabels.map((_, dayIndex) => {
                const isProposed = cellCoversProposed(dayIndex, hour, proposed);
                const isProposedStart =
                  isProposed &&
                  proposed &&
                  hour === Math.floor(proposed.startHour);
                const cellBlocks = blocksAt(dayIndex, hour);
                return (
                  <button
                    key={`${dayIndex}-${hour}`}
                    type="button"
                    ref={isProposedStart ? proposedRef : undefined}
                    className={[
                      'relative min-h-12 w-full p-0.5 text-left transition-colors',
                      isProposed
                        ? 'bg-accent/25 ring-2 ring-inset ring-accent'
                        : 'bg-bg hover:bg-accent/10',
                    ].join(' ')}
                    title={
                      isProposed
                        ? 'Horario de la cita'
                        : 'Seleccionar este horario'
                    }
                    onClick={() => handleCellClick(dayIndex, hour)}
                  >
                    {isProposedStart && proposed ? (
                      <div
                        className={`mb-0.5 truncate rounded px-1 py-1 text-[10px] font-bold ${TONE_CLASS.proposed}`}
                      >
                        {proposed.label}
                      </div>
                    ) : null}
                    {cellBlocks.map((b) => (
                      <div
                        key={b.id}
                        className={`mb-0.5 truncate rounded px-1 py-0.5 text-[10px] font-bold ${TONE_CLASS[b.tone]}`}
                        title={b.label}
                      >
                        {b.label}
                      </div>
                    ))}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
