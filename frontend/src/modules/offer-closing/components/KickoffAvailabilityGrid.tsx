import { useEffect, useMemo, useRef } from 'react';
import {
  buildAvailabilityGrid,
  weekDayLabels,
  type BusyBlock,
} from '../lib/kickoff-scheduling';
import type {
  KickoffInvitee,
  KickoffSalaVerytel,
} from '../../shared/project/types';
import { cardClass } from './ui';

const BASE_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

const TONE_CLASS: Record<BusyBlock['tone'], string> = {
  busy: 'bg-muted/35 text-ink',
  provisional: 'border-l-2 border-dashed border-muted bg-bg text-muted',
  proposed: 'border border-accent bg-accent text-white',
  room: 'bg-brand/20 text-brand',
};

type Props = {
  weekAnchor: Date;
  invitados: KickoffInvitee[];
  salaVerytel: KickoffSalaVerytel | null;
  proposedStart: Date | null;
  proposedEnd: Date | null;
  onSelectSlot?: (start: Date, end: Date) => void;
};

function hoursCovering(proposedStart: Date | null, proposedEnd: Date | null): number[] {
  let minH = 8;
  let maxH = 18;
  if (proposedStart) minH = Math.min(minH, proposedStart.getHours());
  if (proposedEnd) {
    const endH =
      proposedEnd.getMinutes() > 0
        ? proposedEnd.getHours()
        : Math.max(proposedEnd.getHours() - 1, proposedStart?.getHours() ?? 8);
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

/** Weekly availability grid — highlights and scrolls to your proposed slot. */
export function KickoffAvailabilityGrid({
  weekAnchor,
  invitados,
  salaVerytel,
  proposedStart,
  proposedEnd,
  onSelectSlot,
}: Props) {
  const dayLabels = weekDayLabels(weekAnchor);
  const hours = useMemo(
    () => hoursCovering(proposedStart, proposedEnd),
    [proposedStart, proposedEnd],
  );
  const blocks = buildAvailabilityGrid({
    weekAnchor,
    invitados,
    salaVerytel,
    proposedStart,
    proposedEnd,
  });
  const proposed = blocks.find((b) => b.tone === 'proposed');
  const proposedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    proposedRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }, [proposedStart?.getTime(), proposedEnd?.getTime()]);

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
    const monday = new Date(weekAnchor);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    const start = new Date(monday);
    start.setDate(monday.getDate() + dayIndex);
    start.setHours(hour, 0, 0, 0);

    const durationMs =
      proposedStart && proposedEnd
        ? Math.max(proposedEnd.getTime() - proposedStart.getTime(), 30 * 60_000)
        : 60 * 60_000;
    const end = new Date(start.getTime() + durationMs);
    onSelectSlot(start, end);
  }

  const proposedLabel =
    proposedStart && proposedEnd
      ? `${proposedStart.toLocaleString('es-CO', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })} – ${proposedEnd.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : null;

  return (
    <div className={`${cardClass} overflow-x-auto p-3`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-muted">
            Disponibilidad (lun–vie) — internos y salas Verytel
          </p>
          <p className="mt-1 text-xs text-muted">
            Haz clic en una celda libre para mover tu espacio.
          </p>
        </div>
        {proposedLabel ? (
          <div className="rounded border border-accent bg-accent/15 px-3 py-2 text-xs font-bold text-accent">
            Tu espacio: {proposedLabel}
          </div>
        ) : (
          <div className="rounded border border-border bg-bg px-3 py-2 text-xs text-muted">
            Sin horario propuesto — regresa y define fecha/hora.
          </div>
        )}
      </div>

      <div className="min-w-[720px]">
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
                        ? 'Tu espacio seleccionado'
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

      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-muted/35" /> Ocupado
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-4 rounded border border-dashed border-muted bg-bg" />{' '}
          Provisional
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-brand/20" /> Sala
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-accent" /> Tu espacio
        </span>
      </div>
    </div>
  );
}
