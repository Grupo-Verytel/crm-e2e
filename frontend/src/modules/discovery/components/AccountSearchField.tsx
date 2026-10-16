import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { fetchAccounts } from '../../accounts/api/accounts-api';
import type { Account } from '../../accounts/types';
import { inputClass } from './ui';

type Props = {
  id?: string;
  selected: Account | null;
  onSelect: (account: Account) => void;
  onClear?: () => void;
};

/** Searchable account picker; typing filters by name or NIT coincidences. */
export function AccountSearchField({ id, selected, onSelect, onClear }: Props) {
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Account[]>([]);
  const [searching, setSearching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    setQuery(selected?.name ?? '');
  }, [selected]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected?.name ?? '');
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [selected]);

  useEffect(() => {
    if (!open) return undefined;
    const seq = ++requestSeq.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const data = await fetchAccounts({
            q: query.trim() || undefined,
            limit: 12,
          });
          if (requestSeq.current !== seq) return;
          setHits(data.items);
        } catch {
          if (requestSeq.current !== seq) return;
          setHits([]);
        } finally {
          if (requestSeq.current === seq) setSearching(false);
        }
      })();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, query]);

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
        placeholder="Buscar empresa…"
        autoComplete="off"
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (selected && next !== selected.name && onClear) onClear();
        }}
        onFocus={() => setOpen(true)}
      />
      {open ? (
        <ul
          className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded border border-border bg-surface shadow-card"
          role="listbox"
        >
          {searching && hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">Buscando…</li>
          ) : hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">Sin coincidencias.</li>
          ) : (
            hits.map((account) => {
              const isSelected = account.account_id === selected?.account_id;
              return (
                <li key={account.account_id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={[
                      'flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-bg',
                      isSelected ? 'bg-bg' : '',
                    ].join(' ')}
                    onClick={() => {
                      onSelect(account);
                      setQuery(account.name);
                      setOpen(false);
                    }}
                  >
                    <span className="text-sm font-bold text-ink">
                      {account.name}
                    </span>
                    {account.tax_id ? (
                      <span className="text-xs text-muted">
                        NIT: {account.tax_id}
                      </span>
                    ) : null}
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
