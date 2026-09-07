import { useEffect, useState } from 'react';
import { formatDateTime } from '../../../lib/format';
import { fetchInteractions } from '../api/leads-api';
import {
  INTERACTION_CANAL_LABEL,
  INTERACTION_TIPO_LABEL,
  type Interaction,
  type InteractionCanal,
  type InteractionTipo,
} from '../types';
import { cardClass, ghostButtonClass } from './ui';
import { QuickInteractionModal } from './leads/QuickInteractionModal';

export function InteractionTimeline({
  leadId,
  leadName,
  onRegistered,
  readOnly = false,
}: {
  leadId: string;
  leadName: string;
  onRegistered: () => void;
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<Interaction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await fetchInteractions(leadId));
      setError(null);
    } catch {
      setError('No se pudieron cargar las interacciones.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  return (
    <section className={`${cardClass} p-5`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Interacciones</h2>
          <p className="text-xs text-muted">
            Registra el tipo de comunicación y el canal acorde (llamada,
            reunión, email, etc.).
          </p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            className={ghostButtonClass}
            onClick={() => setShowModal(true)}
          >
            Registrar interacción
          </button>
        ) : null}
      </div>

      {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}

      {items.length === 0 ? (
        <p className="rounded border border-dashed border-border bg-bg px-3 py-6 text-center text-sm text-muted">
          Aún no hay interacciones registradas.
        </p>
      ) : (
        <ol className="space-y-3 border-l border-border pl-4">
          {items.map((interaction) => (
            <li key={interaction.interaction_id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-accent" />
              <p className="text-sm font-bold text-ink">
                {INTERACTION_TIPO_LABEL[
                  interaction.tipo as InteractionTipo
                ] ?? interaction.tipo}{' '}
                ·{' '}
                {INTERACTION_CANAL_LABEL[
                  interaction.canal as InteractionCanal
                ] ?? interaction.canal}
              </p>
              {interaction.descripcion ? (
                <p className="text-sm text-ink">{interaction.descripcion}</p>
              ) : null}
              <p className="text-xs text-muted">
                {formatDateTime(interaction.fecha)}
              </p>
            </li>
          ))}
        </ol>
      )}

      {showModal ? (
        <QuickInteractionModal
          leadId={leadId}
          leadName={leadName}
          subtitle={`Registra una interacción para ${leadName}.`}
          submitLabel="Guardar interacción"
          descriptionRequired
          onRegistered={async () => {
            await load();
            onRegistered();
          }}
          onClose={() => setShowModal(false)}
        />
      ) : null}
    </section>
  );
}
