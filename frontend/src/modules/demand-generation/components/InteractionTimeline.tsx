import { useCallback, useEffect, useState } from 'react';
import { formatDateTime } from '../../../lib/format';
import { fetchInteractions } from '../api/leads-api';
import {
  INTERACTION_CANAL_LABEL,
  INTERACTION_TIPO_LABEL,
  type CreateInteractionPayload,
  type Interaction,
  type InteractionCanal,
  type InteractionTipo,
} from '../types';
import { cardClass, ghostButtonClass } from './ui';
import { InteractionReminderModal } from './InteractionReminderModal';
import { QuickInteractionModal } from './leads/QuickInteractionModal';

type LoadState = 'loading' | 'error' | 'ready';

function authorLine(interaction: Interaction): string {
  if (!interaction.responsable_nombre) {
    return 'Sin registro de autor';
  }
  const role = interaction.responsable_rol?.trim();
  return role
    ? `Registrada por ${interaction.responsable_nombre} · ${role}`
    : `Registrada por ${interaction.responsable_nombre}`;
}

export function InteractionTimeline({
  leadId,
  leadName,
  onRegistered,
  readOnly = false,
  loadInteractions,
  register,
  createReminder,
}: {
  leadId: string;
  leadName?: string;
  onRegistered: () => void;
  readOnly?: boolean;
  loadInteractions?: () => Promise<Interaction[]>;
  register?: (payload: CreateInteractionPayload) => Promise<unknown>;
  createReminder?: (
    interactionId: string,
    payload: { event_at: string; remind_days_before: number; note?: string },
  ) => Promise<unknown>;
}) {
  const [items, setItems] = useState<Interaction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [reminderFor, setReminderFor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const title = leadName?.trim() || 'este lead';

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const next = loadInteractions
        ? await loadInteractions()
        : await fetchInteractions(leadId);
      setItems(next);
      setLoadState('ready');
    } catch {
      setItems([]);
      setLoadState('error');
    }
  }, [leadId, loadInteractions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on source change
    void load();
  }, [load]);

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

      {loadState === 'loading' ? (
        <p className="text-sm text-muted">Cargando interacciones…</p>
      ) : null}

      {loadState === 'error' ? (
        <div className="rounded border border-border bg-bg px-3 py-6 text-center">
          <p className="text-sm text-danger">No se pudieron cargar las interacciones.</p>
          <button
            type="button"
            className={`${ghostButtonClass} mt-3`}
            onClick={() => void load()}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {loadState === 'ready' && items.length === 0 ? (
        <p className="rounded border border-dashed border-border bg-bg px-3 py-6 text-center text-sm text-muted">
          Aún no hay interacciones registradas.
        </p>
      ) : null}

      {loadState === 'ready' && items.length > 0 ? (
        <ol className="space-y-3 border-l border-border pl-4">
          {items.map((interaction) => (
            <li key={interaction.interaction_id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-accent" />
              <p className="text-sm font-bold text-ink">
                {INTERACTION_TIPO_LABEL[interaction.tipo as InteractionTipo] ??
                  interaction.tipo}{' '}
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
                {interaction.etapa ? ` · ${interaction.etapa}` : ''}
                {' · '}
                {authorLine(interaction)}
              </p>
              {(interaction.reminders ?? []).map((reminder) => (
                <p key={reminder.reminder_id} className="text-xs text-muted">
                  Recordatorio: {formatDateTime(reminder.event_at)} · avisar{' '}
                  {reminder.remind_days_before}{' '}
                  {reminder.remind_days_before === 1 ? 'día' : 'días'} antes
                  {reminder.status === 'Enviado' ? ' · Avisado' : ''}
                  {reminder.note ? ` · ${reminder.note}` : ''}
                </p>
              ))}
              {createReminder ? (
                <button
                  type="button"
                  className="mt-1 text-xs font-bold text-accent hover:underline"
                  onClick={() => setReminderFor(interaction.interaction_id)}
                >
                  Recordatorio
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {showModal ? (
        <QuickInteractionModal
          leadId={leadId}
          leadName={title}
          subtitle={`Registra una interacción para ${title}.`}
          submitLabel="Guardar interacción"
          descriptionRequired
          register={register}
          onRegistered={async () => {
            await load();
            onRegistered();
          }}
          onClose={() => setShowModal(false)}
        />
      ) : null}

      {reminderFor && createReminder ? (
        <InteractionReminderModal
          onClose={() => setReminderFor(null)}
          onSave={async (payload) => {
            await createReminder(reminderFor, payload);
            await load();
            onRegistered();
          }}
        />
      ) : null}
    </section>
  );
}
