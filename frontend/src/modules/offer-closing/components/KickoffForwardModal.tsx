import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { KickoffInvitee, KickoffRecord } from '../../shared/project/types';
import {
  kickoffInviteeTipoLabel,
  loadKickoffInviteCandidates,
  type KickoffInviteCandidate,
} from '../lib/kickoff-invite-candidates';
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './ui';

type Props = {
  open: boolean;
  onClose: () => void;
  ouvId: string;
  accountId?: string | null;
  empresaNombre?: string | null;
  kickoff: KickoffRecord;
  onChange: (kickoff: KickoffRecord) => void;
};

export function KickoffForwardModal({
  open,
  onClose,
  ouvId,
  accountId = null,
  empresaNombre = null,
  kickoff,
  onChange,
}: Props) {
  const existing = kickoff.agenda?.invitados ?? [];
  const [candidates, setCandidates] = useState<KickoffInviteCandidate[]>([]);
  const [query, setQuery] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [added, setAdded] = useState<KickoffInvitee[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setAdded([]);
    setListOpen(false);
  }, [open, kickoff.agenda?.confirmadaEn]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadKickoffInviteCandidates({ ouvId, accountId, empresaNombre }).then(
      (rows) => {
        if (!cancelled) setCandidates(rows);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, accountId, empresaNombre, ouvId]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) {
        setListOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const takenIds = useMemo(() => {
    const ids = new Set(existing.map((i) => i.id));
    for (const inv of added) ids.add(inv.id);
    return ids;
  }, [added, existing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = candidates.filter((c) => !takenIds.has(c.id));
    if (!q) return available.slice(0, 8);
    return available
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.origenLabel.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [candidates, query, takenIds]);

  function addCandidate(candidate: KickoffInviteCandidate) {
    setAdded((prev) => {
      if (
        prev.some((i) => i.id === candidate.id || i.email === candidate.email)
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          id: candidate.id,
          email: candidate.email,
          nombre: candidate.nombre,
          tipo: candidate.tipo,
        },
      ];
    });
    setQuery('');
    setListOpen(false);
  }

  function confirmForward() {
    if (!kickoff.agenda || added.length === 0) {
      onClose();
      return;
    }
    onChange({
      ...kickoff,
      agenda: {
        ...kickoff.agenda,
        invitados: [...kickoff.agenda.invitados, ...added],
      },
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reenviar a"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded bg-surface shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-base font-bold text-ink">Reenviar a</h2>
          <button
            type="button"
            className="text-sm text-muted hover:text-ink"
            onClick={onClose}
          >
            Cerrar
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-muted">
            Agrega contactos o usuarios internos. Recibirán el enlace de la
            reunión ya programada.
          </p>

          <div>
            <label className={labelClass} htmlFor="ko-forward-search">
              Destinatarios
            </label>
            <div className="relative" ref={boxRef}>
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent"
                strokeWidth={2}
                aria-hidden
              />
              <input
                id="ko-forward-search"
                className={`${inputClass} pl-9`}
                value={query}
                placeholder="Buscar por nombre o correo…"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setListOpen(true);
                }}
                onFocus={() => setListOpen(true)}
                autoComplete="off"
              />
              {listOpen ? (
                <ul
                  className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded border border-border bg-surface shadow-card"
                  role="listbox"
                >
                  {filtered.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted">
                      Sin coincidencias.
                    </li>
                  ) : (
                    filtered.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-bg"
                          onClick={() => addCandidate(c)}
                        >
                          <span className="text-sm font-bold text-ink">
                            {c.nombre}
                          </span>
                          <span className="text-xs text-muted">
                            {c.email} · {c.origenLabel}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          </div>

          {added.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {added.map((inv) => (
                <li
                  key={inv.id}
                  className="inline-flex items-center gap-1 rounded border border-border bg-bg px-2 py-1 text-xs"
                >
                  <span className="font-bold text-ink">{inv.nombre}</span>
                  <span className="text-muted">
                    · {kickoffInviteeTipoLabel(inv.tipo)}
                  </span>
                  <button
                    type="button"
                    className="text-muted hover:text-danger"
                    aria-label={`Quitar ${inv.nombre}`}
                    onClick={() =>
                      setAdded((prev) => prev.filter((i) => i.id !== inv.id))
                    }
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">Ningún destinatario nuevo.</p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={added.length === 0}
            onClick={confirmForward}
          >
            Reenviar
          </button>
        </footer>
      </div>
    </div>
  );
}
