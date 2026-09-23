import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock } from 'lucide-react';

type Props = {
  id?: string;
  value: string;
  onChange: (hhMm: string) => void;
  className?: string;
  stepMinutes?: number;
  /** Primera hora ofrecida, `HH:mm` inclusive. */
  minTime?: string;
  /** Última hora ofrecida, `HH:mm` inclusive. */
  maxTime?: string;
  /**
   * Hora de inicio (`HH:mm`). Si está, cada opción muestra la duración
   * como en Outlook: `7:00 a. m. (1 hora)`.
   */
  durationFrom?: string;
  'aria-label'?: string;
};

function parseHhMm(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function toHhMm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function minutesOf(value: string): number | null {
  const parsed = parseHhMm(value);
  return parsed ? parsed.hour * 60 + parsed.minute : null;
}

function formatOutlookTime(value: string): string {
  const parsed = parseHhMm(value);
  if (!parsed) return '--:--';
  return new Date(2000, 0, 1, parsed.hour, parsed.minute).toLocaleTimeString(
    'es-CO',
    { hour: 'numeric', minute: '2-digit', hour12: true },
  );
}

function formatOutlookDuration(minutes: number): string {
  if (minutes === 0) return '0 minutos';
  if (minutes < 60) return `${minutes} minutos`;
  const hours = minutes / 60;
  if (hours === 1) return '1 hora';
  const label = Number.isInteger(hours)
    ? String(hours)
    : String(hours).replace('.', ',');
  return `${label} horas`;
}

function formatOptionLabel(value: string, durationFrom?: string): string {
  const time = formatOutlookTime(value);
  if (!durationFrom) return time;
  const start = minutesOf(durationFrom);
  const end = minutesOf(value);
  if (start === null || end === null || end < start) return time;
  return `${time} (${formatOutlookDuration(end - start)})`;
}

function buildOptions(
  stepMinutes: number,
  minTime: string,
  maxTime: string,
  extras: string[],
): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      const option = toHhMm(hour, minute);
      if (option >= minTime && option <= maxTime) options.push(option);
    }
  }
  for (const extra of extras) {
    const normalized = parseHhMm(extra);
    if (!normalized) continue;
    const option = toHhMm(normalized.hour, normalized.minute);
    if (
      option >= minTime &&
      option <= maxTime &&
      !options.includes(option)
    ) {
      options.push(option);
    }
  }
  options.sort();
  return options;
}

/** Outlook-style time dropdown. Value stays `HH:mm` for the API. */
export function TimePickerField({
  id,
  value,
  onChange,
  className = '',
  stepMinutes = 30,
  minTime = '00:00',
  maxTime = '23:59',
  durationFrom,
  'aria-label': ariaLabel,
}: Props) {
  const startAt = durationFrom?.slice(0, 5);
  const rangeStart = startAt && startAt > minTime ? startAt : minTime;
  const options = useMemo(
    () =>
      buildOptions(stepMinutes, rangeStart, maxTime, [value, startAt ?? '']),
    [stepMinutes, rangeStart, maxTime, value, startAt],
  );

  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;

    function placePanel() {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const width = Math.max(rect.width, durationFrom ? 220 : 160);
      const estimatedHeight = 280;
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;
      setPanelStyle({
        position: 'fixed',
        left: Math.min(rect.left, window.innerWidth - width - 8),
        width,
        top: openUp ? undefined : rect.bottom + gap,
        bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
        zIndex: 80,
      });
    }

    placePanel();
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    return () => {
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
    };
  }, [open, durationFrom]);

  useEffect(() => {
    if (!open) return;
    selectedRef.current?.scrollIntoView({ block: 'center' });
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="rounded border border-border bg-surface py-1 shadow-card"
          role="listbox"
          aria-label="Elegir hora"
        >
          <div className="max-h-64 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option === value.slice(0, 5);
              return (
                <button
                  key={option}
                  ref={isSelected ? selectedRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    'flex w-full px-3 py-1.5 text-left text-sm',
                    isSelected
                      ? 'bg-accent font-bold text-white'
                      : 'text-ink hover:bg-bg',
                  ].join(' ')}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  {formatOptionLabel(option, durationFrom)}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel ?? 'Hora'}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-9 w-full items-center gap-2 rounded border border-border bg-bg px-3 text-left text-sm text-ink outline-none hover:border-accent focus:border-accent focus:bg-surface"
        onClick={() => setOpen((current) => !current)}
      >
        <Clock size={15} className="shrink-0 text-accent" strokeWidth={2} />
        <span className={value ? 'flex-1 text-ink' : 'flex-1 text-muted'}>
          {value ? formatOutlookTime(value) : '--:--'}
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted" strokeWidth={2} aria-hidden />
      </button>
      {panel}
    </div>
  );
}
