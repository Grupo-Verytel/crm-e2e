import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

type Props = {
  id?: string;
  value: string;
  onChange: (yyyyMmDd: string) => void;
  className?: string;
  'aria-label'?: string;
};

function parseYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDisplay(value: string): string {
  const date = parseYmd(value);
  if (!date) return 'Seleccionar fecha';
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** Themed date picker — replaces native type=date (no dark calendar UI). */
export function DatePickerField({
  id,
  value,
  onChange,
  className = '',
  'aria-label': ariaLabel,
}: Props) {
  const selected = parseYmd(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => selected ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) setView(selected);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  const rows = useMemo(
    () => monthMatrix(view.getFullYear(), view.getMonth()),
    [view],
  );

  const todayYmd = toYmd(new Date());

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel ?? 'Fecha'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-9 w-full items-center gap-2 rounded border border-border bg-bg px-3 text-left text-sm text-ink outline-none hover:border-accent focus:border-accent focus:bg-surface"
        onClick={() => setOpen((v) => !v)}
      >
        <Calendar size={15} className="shrink-0 text-accent" strokeWidth={2} />
        <span className={selected ? 'text-ink' : 'text-muted'}>
          {formatDisplay(value)}
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 z-50 mt-1 w-[17.5rem] rounded border border-border bg-surface p-3 shadow-card"
          role="dialog"
          aria-label="Calendario"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="icon-btn grid h-8 w-8 place-items-center rounded"
              aria-label="Mes anterior"
              onClick={() =>
                setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-bold capitalize text-ink">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </p>
            <button
              type="button"
              className="icon-btn grid h-8 w-8 place-items-center rounded"
              aria-label="Mes siguiente"
              onClick={() =>
                setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-muted">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {rows.flatMap((row, ri) =>
              row.map((day, di) => {
                if (!day) {
                  return <span key={`${ri}-${di}`} className="h-8" />;
                }
                const ymd = toYmd(day);
                const isSelected = ymd === value;
                const isToday = ymd === todayYmd;
                return (
                  <button
                    key={ymd}
                    type="button"
                    className={[
                      'grid h-8 place-items-center rounded text-sm font-bold transition-colors',
                      isSelected
                        ? 'bg-accent text-white'
                        : isToday
                          ? 'bg-accent/15 text-accent'
                          : 'text-ink hover:bg-bg',
                    ].join(' ')}
                    onClick={() => {
                      onChange(ymd);
                      setOpen(false);
                    }}
                  >
                    {day.getDate()}
                  </button>
                );
              }),
            )}
          </div>

          <div className="mt-2 flex justify-between border-t border-border pt-2">
            <button
              type="button"
              className="text-xs font-bold text-muted hover:text-accent"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Borrar
            </button>
            <button
              type="button"
              className="text-xs font-bold text-accent hover:underline"
              onClick={() => {
                onChange(todayYmd);
                setOpen(false);
              }}
            >
              Hoy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
