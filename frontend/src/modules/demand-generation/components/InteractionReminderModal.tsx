import { useState } from 'react';
import { toDatetimeLocalValue } from '../lib/interaction-fecha';
import { ModalShell } from './ModalShell';
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './ui';

type Props = {
  onClose: () => void;
  onSave: (payload: {
    event_at: string;
    remind_days_before: number;
    note?: string;
  }) => Promise<void>;
};

export function InteractionReminderModal({ onClose, onSave }: Props) {
  const [eventAt, setEventAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [daysBefore, setDaysBefore] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit() {
    const days = Number(daysBefore);
    if (!eventAt || !Number.isInteger(days) || days < 0 || days > 365) {
      setError('Indica la fecha del evento y cuántos días antes avisar (0 a 365).');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        event_at: new Date(eventAt).toISOString(),
        remind_days_before: days,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'No se pudo guardar el recordatorio.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalShell title="Recordatorio" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          El aviso llega el número de días indicado antes de la fecha del evento.
          Cero días es el mismo día.
        </p>
        <div>
          <label htmlFor="reminder-event" className={labelClass}>
            Fecha del evento
          </label>
          <input
            id="reminder-event"
            type="datetime-local"
            value={eventAt}
            onChange={(event) => setEventAt(event.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="reminder-days" className={labelClass}>
            Avisar días antes
          </label>
          <input
            id="reminder-days"
            type="number"
            min={0}
            max={365}
            value={daysBefore}
            onChange={(event) => setDaysBefore(event.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="reminder-note" className={labelClass}>
            Nota
          </label>
          <textarea
            id="reminder-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
            className={`${inputClass} h-auto py-2`}
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving}
            className={primaryButtonClass}
          >
            {isSaving ? 'Guardando…' : 'Guardar recordatorio'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
