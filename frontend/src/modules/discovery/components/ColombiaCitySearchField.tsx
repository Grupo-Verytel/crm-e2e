import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  searchColombiaMunicipios,
  type ColombiaMunicipio,
} from '../lib/colombia-municipios';
import { inputClass } from './ui';

type Props = {
  id?: string;
  value: string;
  departamento?: string;
  onSelect: (row: ColombiaMunicipio) => void;
  onClear?: () => void;
};

/** Searchable Colombia municipality picker; selecting fills department. */
export function ColombiaCitySearchField({
  id,
  value,
  departamento,
  onSelect,
  onClear,
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [value]);

  const results = useMemo(
    () => searchColombiaMunicipios(query, 12),
    [query],
  );

  return (
    <div className="relative" ref={rootRef}>
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent"
        strokeWidth={2}
        aria-hidden
      />
      <input
        id={id}
        className={`${inputClass} pl-9`}
        value={query}
        placeholder="Buscar municipio…"
        autoComplete="off"
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (!next.trim() && onClear) onClear();
        }}
        onFocus={() => setOpen(true)}
      />
      {open ? (
        <ul
          className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded border border-border bg-surface shadow-card"
          role="listbox"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">Sin coincidencias.</li>
          ) : (
            results.map((row) => {
              const key = `${row.municipio}|${row.departamento}`;
              const selected =
                row.municipio === value &&
                (!departamento || row.departamento === departamento);
              return (
                <li key={key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={[
                      'flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-bg',
                      selected ? 'bg-bg' : '',
                    ].join(' ')}
                    onClick={() => {
                      onSelect(row);
                      setQuery(row.municipio);
                      setOpen(false);
                    }}
                  >
                    <span className="text-sm font-bold text-ink">
                      {row.municipio}
                    </span>
                    <span className="text-xs text-muted">
                      {row.departamento}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
