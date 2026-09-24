import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

type ListAnchor = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

function measureList(root: HTMLElement, resultCount: number): ListAnchor {
  const rect = root.getBoundingClientRect();
  const gap = 4;
  const preferred = Math.min(224, Math.max(44, resultCount * 52));
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;
  const openUp = spaceBelow < preferred && spaceAbove > spaceBelow;
  const maxHeight = Math.max(80, Math.min(224, openUp ? spaceAbove : spaceBelow));
  return openUp
    ? {
        bottom: window.innerHeight - rect.top + gap,
        left: rect.left,
        width: rect.width,
        maxHeight,
      }
    : {
        top: rect.bottom + gap,
        left: rect.left,
        width: rect.width,
        maxHeight,
      };
}

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
  const [anchor, setAnchor] = useState<ListAnchor | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setQuery(value);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [value]);

  const results = useMemo(
    () => searchColombiaMunicipios(query, 12),
    [query],
  );

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!rootRef.current) return;
      setAnchor(measureList(rootRef.current, Math.max(results.length, 1)));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, results.length]);

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
      {open && anchor
        ? createPortal(
        <ul
          ref={listRef}
          className="fixed z-80 overflow-y-auto rounded border border-border bg-surface shadow-card"
          style={{
            top: anchor.top,
            bottom: anchor.bottom,
            left: anchor.left,
            width: anchor.width,
            maxHeight: anchor.maxHeight,
          }}
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
        </ul>,
          document.body,
        )
        : null}
    </div>
  );
}
