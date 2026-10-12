import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { DatePickerField } from '../../../components/DatePickerField';
import { TimePickerField } from '../../../components/TimePickerField';
import { ModalShell } from '../../demand-generation/components/ModalShell';
import {
  INTERACTION_CANAL_LABEL,
  INTERACTION_TIPO_LABEL,
  INTERACTION_TIPOS,
  canalesForTipo,
  type InteractionCanal,
  type InteractionTipo,
} from '../../demand-generation/types';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../../demand-generation/components/ui';
import {
  combineReminderIso,
  upsertOuvReminder,
} from '../../shared/reminders/store';
import { registerSqlInteraction } from '../api/sql-interactions-api';
import { saveSqlInteractionTitle } from '../lib/sql-interaction-titles';

type Props = {
  sqlId: string;
  sqlLabel: string;
  sqlConsecutivo: string;
  onRegistered: () => void | Promise<void>;
  onClose: () => void;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function defaultReminderParts(): { date: string; time: string } {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const rounded = Math.ceil(d.getMinutes() / 15) * 15;
  if (rounded === 60) {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  } else {
    d.setMinutes(rounded);
  }
  d.setSeconds(0, 0);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function SqlQuickInteractionModal({
  sqlId,
  sqlLabel,
  sqlConsecutivo,
  onRegistered,
  onClose,
}: Props) {
  const [tipo, setTipo] = useState<InteractionTipo>('Llamada');
  const canales = useMemo(() => canalesForTipo(tipo), [tipo]);
  const [canal, setCanal] = useState<InteractionCanal>(canales[0] ?? 'Telefono');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [recordarme, setRecordarme] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRecordarme(checked: boolean) {
    setRecordarme(checked);
    setError(null);
    if (checked && !reminderDate && !reminderTime) {
      const next = defaultReminderParts();
      setReminderDate(next.date);
      setReminderTime(next.time);
    }
  }

  useEffect(() => {
    if (!canales.includes(canal)) {
      setCanal(canales[0] ?? 'Telefono');
    }
  }, [canales, canal]);

  async function handleSubmit() {
    if (!titulo.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    if (!descripcion.trim()) {
      setError('La descripción es obligatoria.');
      return;
    }
    let recordatorioAt: string | null = null;
    if (recordarme) {
      const iso = combineReminderIso(reminderDate, reminderTime);
      if (!iso) {
        setError('Indica fecha y hora del recordatorio.');
        return;
      }
      if (new Date(iso).getTime() <= Date.now()) {
        setError('El recordatorio debe ser una fecha y hora futuras.');
        return;
      }
      recordatorioAt = iso;
    }
    setIsSaving(true);
    setError(null);
    try {
      const created = await registerSqlInteraction(sqlId, {
        tipo,
        canal,
        descripcion: descripcion.trim(),
      });
      saveSqlInteractionTitle(created.sql_interaction_id, titulo.trim());
      if (recordatorioAt) {
        upsertOuvReminder({
          reminder_id: `rem-${created.sql_interaction_id}`,
          ouv_id: sqlId,
          ouv_consecutivo: sqlConsecutivo,
          ouv_titulo: sqlLabel,
          interaccion_id: created.sql_interaction_id,
          interaccion_titulo: titulo.trim(),
          remind_at: recordatorioAt,
          entity_kind: 'Lead',
        });
      }
      await onRegistered();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo registrar la interacción.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalShell title="Registrar interacción" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="sql-qi-titulo" className={labelClass}>
            Título
          </label>
          <input
            id="sql-qi-titulo"
            className={inputClass}
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sql-qi-tipo" className={labelClass}>
              Tipo de comunicación
            </label>
            <select
              id="sql-qi-tipo"
              value={tipo}
              onChange={(event) => setTipo(event.target.value as InteractionTipo)}
              className={inputClass}
            >
              {INTERACTION_TIPOS.map((value) => (
                <option key={value} value={value}>
                  {INTERACTION_TIPO_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sql-qi-canal" className={labelClass}>
              Canal
            </label>
            <select
              id="sql-qi-canal"
              value={canal}
              onChange={(event) =>
                setCanal(event.target.value as InteractionCanal)
              }
              className={inputClass}
            >
              {canales.map((value) => (
                <option key={value} value={value}>
                  {INTERACTION_CANAL_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="sql-qi-desc" className={labelClass}>
            Descripción
          </label>
          <textarea
            id="sql-qi-desc"
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            rows={3}
            placeholder="Ej. Seguimiento post-cita con el contacto del SQL."
            className={`${inputClass} h-auto py-2`}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={recordarme}
              onChange={(event) => toggleRecordarme(event.target.checked)}
            />
            Recordarme
          </label>
          <Bell
            size={13}
            strokeWidth={1.75}
            className="pointer-events-none text-ink"
            aria-hidden
          />
        </div>

        {recordarme ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="sql-qi-reminder-date">
                Fecha
              </label>
              <DatePickerField
                id="sql-qi-reminder-date"
                value={reminderDate}
                onChange={(value) => {
                  setReminderDate(value);
                  setError(null);
                }}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="sql-qi-reminder-time">
                Hora
              </label>
              <TimePickerField
                id="sql-qi-reminder-time"
                editable
                value={reminderTime}
                onChange={(value) => {
                  setReminderTime(value);
                  setError(null);
                }}
              />
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving || !titulo.trim()}
            className={primaryButtonClass}
          >
            {isSaving ? 'Guardando…' : 'Guardar interacción'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
