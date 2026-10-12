import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  INTERACTION_CANAL_LABEL,
  INTERACTION_TIPO_LABEL,
  type InteractionCanal,
  type InteractionTipo,
} from '../../demand-generation/types';
import {
  listRemindersForOuv,
  removeOuvReminderByInteraccion,
} from '../../shared/reminders/store';
import {
  deleteSqlInteraction,
  fetchSqlInteractions,
} from '../api/sql-interactions-api';
import {
  getSqlInteractionTitle,
  removeSqlInteractionTitle,
} from '../lib/sql-interaction-titles';
import type { SqlInteraction } from '../types/sql-interaction.types';
import { cardClass, ghostButtonClass } from './ui';
import { SqlQuickInteractionModal } from './SqlQuickInteractionModal';

type Props = {
  sqlId: string;
  sqlLabel: string;
  sqlConsecutivo: string;
  onRegistered: () => void;
  readOnly?: boolean;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('es-CO');
}

function formatReminderShort(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SqlInteractionTimeline({
  sqlId,
  sqlLabel,
  sqlConsecutivo,
  onRegistered,
  readOnly = false,
}: Props) {
  const [items, setItems] = useState<SqlInteraction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reminders = listRemindersForOuv(sqlId);

  async function load() {
    try {
      setItems(await fetchSqlInteractions(sqlId));
      setError(null);
    } catch {
      setError('No se pudieron cargar las interacciones.');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlId]);

  async function handleDelete(interactionId: string) {
    try {
      await deleteSqlInteraction(sqlId, interactionId);
      removeOuvReminderByInteraccion(interactionId);
      removeSqlInteractionTitle(interactionId);
      await load();
      onRegistered();
    } catch {
      setError('No se pudo eliminar la interacción.');
    }
  }

  return (
    <section className={`${cardClass} p-4`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Interacciones</h2>
          <p className="text-xs text-muted">
            Registra las actividades realizadas con el cliente.
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
        <ul className="space-y-3">
          {items.map((interaction) => {
            const reminder = reminders.find(
              (row) => row.interaccion_id === interaction.sql_interaction_id,
            );
            const title =
              getSqlInteractionTitle(interaction.sql_interaction_id) ??
              INTERACTION_TIPO_LABEL[interaction.tipo as InteractionTipo] ??
              interaction.tipo;
            const tipoLabel =
              INTERACTION_TIPO_LABEL[interaction.tipo as InteractionTipo] ??
              interaction.tipo;
            const canalLabel =
              INTERACTION_CANAL_LABEL[interaction.canal as InteractionCanal] ??
              interaction.canal;
            return (
              <li
                key={interaction.sql_interaction_id}
                className="group rounded border border-border bg-bg p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatWhen(interaction.fecha)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
                        {tipoLabel}
                      </span>
                      <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
                        {canalLabel}
                      </span>
                    </div>
                    {interaction.descripcion ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                        {interaction.descripcion}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted">Sin observaciones</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {reminder ? (
                      <p className="text-xs font-bold text-accent">
                        Recordatorio: {formatReminderShort(reminder.remind_at)}
                      </p>
                    ) : null}
                    {!readOnly ? (
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded text-danger opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label="Eliminar interacción"
                        title="Eliminar"
                        onClick={() => void handleDelete(interaction.sql_interaction_id)}
                      >
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showModal ? (
        <SqlQuickInteractionModal
          sqlId={sqlId}
          sqlLabel={sqlLabel}
          sqlConsecutivo={sqlConsecutivo}
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
