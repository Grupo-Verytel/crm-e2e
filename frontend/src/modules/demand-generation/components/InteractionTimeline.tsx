import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { formatDateTime } from '../../../lib/format';
import { fetchInteractions, registerInteraction } from '../api/leads-api';
import {
  INTERACTION_CANALES,
  INTERACTION_TIPOS,
  type Interaction,
  type InteractionCanal,
  type InteractionTipo,
} from '../types';
import { cardClass, inputClass, labelClass, primaryButtonClass } from './ui';

export function InteractionTimeline({
  leadId,
  onRegistered,
}: {
  leadId: string;
  onRegistered: () => void;
}) {
  const [items, setItems] = useState<Interaction[]>([]);
  const [tipo, setTipo] = useState<InteractionTipo>('Llamada');
  const [canal, setCanal] = useState<InteractionCanal>('Telefono');
  const [descripcion, setDescripcion] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await fetchInteractions(leadId);
    setItems(data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on lead change
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await registerInteraction(leadId, {
        tipo,
        canal,
        descripcion: descripcion || undefined,
      });
      setDescripcion('');
      await load();
      onRegistered();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No se pudo registrar la interacción.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={`${cardClass} p-5`}>
      <h2 className="mb-3 text-sm font-bold text-ink">Interacciones</h2>

      <form onSubmit={handleSubmit} className="mb-4 grid gap-3 md:grid-cols-4">
        <div>
          <span className={labelClass}>Tipo</span>
          <select
            value={tipo}
            onChange={(event) => setTipo(event.target.value as InteractionTipo)}
            className={inputClass}
          >
            {INTERACTION_TIPOS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={labelClass}>Canal</span>
          <select
            value={canal}
            onChange={(event) => setCanal(event.target.value as InteractionCanal)}
            className={inputClass}
          >
            {INTERACTION_CANALES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <span className={labelClass}>Descripción</span>
          <input
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-4">
          <button type="submit" disabled={isSaving} className={primaryButtonClass}>
            Registrar interacción
          </button>
        </div>
      </form>

      {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay interacciones registradas.</p>
      ) : (
        <ol className="space-y-3 border-l border-border pl-4">
          {items.map((interaction) => (
            <li key={interaction.interaction_id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-brand" />
              <p className="text-sm font-bold text-ink">
                {interaction.tipo} · {interaction.canal}
              </p>
              {interaction.descripcion ? (
                <p className="text-sm text-ink">{interaction.descripcion}</p>
              ) : null}
              <p className="text-xs text-muted">{formatDateTime(interaction.fecha)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
