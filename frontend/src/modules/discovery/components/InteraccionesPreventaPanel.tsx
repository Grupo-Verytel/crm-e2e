import { useEffect, useState } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { DatePickerField } from '../../../components/DatePickerField';
import { TimePickerField } from '../../../components/TimePickerField';
import {
  combineReminderIso,
  removeOuvReminderByInteraccion,
  upsertOuvReminder,
} from '../../shared/reminders/store';
import type { Ouv } from '../api/ouvs-api';
import {
  loadOuvInteracciones,
  saveOuvInteracciones,
  type InteraccionEntry,
  type InteraccionRecord,
} from '../lib/ouv-interacciones';
import { syncOuvRemindersFromInteracciones } from '../lib/sync-ouv-reminders';
import { ModalShell } from './ModalShell';
import { FloatingToast } from './FloatingToast';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  ouv: Ouv;
};

type ModalMode =
  | { kind: 'nueva' }
  | { kind: 'hilo'; parentId: string; parentTitulo: string };

type InteraccionFormPayload = {
  titulo: string;
  observaciones: string;
  recordatorioAt: string | null;
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

function InteraccionFormModal({
  mode,
  onClose,
  onSave,
}: {
  mode: ModalMode;
  onClose: () => void;
  onSave: (entry: InteraccionFormPayload) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [recordarme, setRecordarme] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderError, setReminderError] = useState<string | null>(null);
  const fechaAuto = new Date().toISOString();

  const isHilo = mode.kind === 'hilo';
  const title = isHilo ? 'Responder hilo' : 'Registrar interacción';

  function toggleRecordarme(checked: boolean) {
    setRecordarme(checked);
    setReminderError(null);
    if (checked && !reminderDate && !reminderTime) {
      const next = defaultReminderParts();
      setReminderDate(next.date);
      setReminderTime(next.time);
    }
  }

  function submit() {
    if (!titulo.trim()) return;
    if (!recordarme) {
      onSave({
        titulo: titulo.trim(),
        observaciones: observaciones.trim(),
        recordatorioAt: null,
      });
      return;
    }
    const iso = combineReminderIso(reminderDate, reminderTime);
    if (!iso) {
      setReminderError('Indica fecha y hora del recordatorio.');
      return;
    }
    if (new Date(iso).getTime() <= Date.now()) {
      setReminderError('El recordatorio debe ser una fecha y hora futuras.');
      return;
    }
    onSave({
      titulo: titulo.trim(),
      observaciones: observaciones.trim(),
      recordatorioAt: iso,
    });
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      {isHilo ? (
        <p className="mb-3 text-sm text-muted">
          Respuesta a:{' '}
          <span className="font-bold text-ink">{mode.parentTitulo}</span>
        </p>
      ) : null}

      <div className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="int-titulo">
            Título de la interacción
          </label>
          <input
            id="int-titulo"
            className={inputClass}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Seguimiento técnico sede Norte"
            autoFocus
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="int-fecha">
            Fecha registrada
          </label>
          <input
            id="int-fecha"
            className={inputClass}
            value={new Date(fechaAuto).toLocaleString('es-CO')}
            disabled
            readOnly
          />
          <p className="mt-1 text-xs text-muted">
            Generada automáticamente por el sistema.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="int-obs">
            Observaciones
          </label>
          <textarea
            id="int-obs"
            className={`${inputClass} min-h-24 py-2`}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas, acuerdos, pendientes…"
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
              <label className={labelClass} htmlFor="int-reminder-date">
                Fecha
              </label>
              <DatePickerField
                id="int-reminder-date"
                value={reminderDate}
                onChange={(value) => {
                  setReminderDate(value);
                  setReminderError(null);
                }}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="int-reminder-time">
                Hora
              </label>
              <TimePickerField
                id="int-reminder-time"
                editable
                value={reminderTime}
                onChange={(value) => {
                  setReminderTime(value);
                  setReminderError(null);
                }}
              />
            </div>
            {reminderError ? (
              <p className="sm:col-span-2 text-xs text-danger">{reminderError}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className={ghostButtonClass} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          disabled={!titulo.trim()}
          onClick={submit}
        >
          {isHilo ? 'Registrar respuesta' : 'Registrar'}
        </button>
      </div>
    </ModalShell>
  );
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

function Etiquetas({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

/** Registro de interacciones / actividades realizadas con el proyecto. */
export function InteraccionesPreventaPanel({ ouv }: Props) {
  const [items, setItems] = useState<InteraccionRecord[]>([]);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadOuvInteracciones(ouv.ouv_id));
    syncOuvRemindersFromInteracciones(ouv);
    setModal(null);
    setToast(null);
  }, [ouv]);

  function persist(list: InteraccionRecord[]) {
    setItems(list);
    saveOuvInteracciones(ouv.ouv_id, list);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }

  function handleSave(data: InteraccionFormPayload) {
    if (!modal) return;
    const now = new Date().toISOString();
    const entry: InteraccionEntry = {
      id: `int-${Date.now()}`,
      titulo: data.titulo,
      observaciones: data.observaciones,
      fechaRegistrada: now,
      registradoPor: 'Usuario actual',
      recordatorioAt: data.recordatorioAt,
    };

    if (data.recordatorioAt) {
      upsertOuvReminder({
        reminder_id: `rem-${entry.id}`,
        ouv_id: ouv.ouv_id,
        ouv_consecutivo: ouv.consecutivo,
        ouv_titulo: ouv.titulo,
        interaccion_id: entry.id,
        interaccion_titulo: entry.titulo,
        remind_at: data.recordatorioAt,
        entity_kind: 'OUV',
      });
    }

    if (modal.kind === 'nueva') {
      persist([{ ...entry, hilos: [] }, ...items]);
      showToast(
        data.recordatorioAt
          ? 'Interacción registrada con recordatorio.'
          : 'Interacción registrada correctamente.',
      );
    } else {
      persist(
        items.map((item) =>
          item.id === modal.parentId
            ? { ...item, hilos: [...item.hilos, entry] }
            : item,
        ),
      );
      showToast(
        data.recordatorioAt
          ? 'Respuesta agregada al hilo con recordatorio.'
          : 'Respuesta agregada al hilo.',
      );
    }
    setModal(null);
  }

  function handleDelete(id: string) {
    const target = items.find((i) => i.id === id);
    removeOuvReminderByInteraccion(id);
    target?.hilos.forEach((hilo) => removeOuvReminderByInteraccion(hilo.id));
    persist(items.filter((i) => i.id !== id));
  }

  function handleDeleteHilo(parentId: string, hiloId: string) {
    removeOuvReminderByInteraccion(hiloId);
    persist(
      items.map((item) =>
        item.id === parentId
          ? { ...item, hilos: item.hilos.filter((h) => h.id !== hiloId) }
          : item,
      ),
    );
  }

  return (
    <section className={`${cardClass} mb-4 p-4`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Interacciones</h2>
          <p className="text-xs text-muted">
            Registra las actividades realizadas con el proyecto (seguimiento
            operativo).
          </p>
        </div>
        <button
          type="button"
          className={ghostButtonClass}
          onClick={() => setModal({ kind: 'nueva' })}
        >
          Registrar interacción
        </button>
      </div>

      {toast ? (
        <FloatingToast
          message={toast}
          tone="success"
          onDismiss={() => setToast(null)}
        />
      ) : null}

      {items.length === 0 ? (
        <p className="rounded border border-dashed border-border bg-bg px-3 py-6 text-center text-sm text-muted">
          Aún no hay interacciones registradas para esta OUV.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="group rounded border border-border bg-bg p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{item.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(item.fechaRegistrada).toLocaleString('es-CO')}
                    {' · '}
                    {item.registradoPor}
                  </p>
                  <Etiquetas tags={item.etiquetas} />
                  {item.observaciones ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                      {item.observaciones}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Sin observaciones</p>
                  )}
                  <button
                    type="button"
                    className="mt-2 text-sm font-bold text-accent hover:underline"
                    onClick={() =>
                      setModal({
                        kind: 'hilo',
                        parentId: item.id,
                        parentTitulo: item.titulo,
                      })
                    }
                  >
                    Responder hilo
                  </button>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.recordatorioAt ? (
                    <p className="text-xs font-bold text-accent">
                      Recordatorio: {formatReminderShort(item.recordatorioAt)}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded text-danger opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="Eliminar interacción"
                    title="Eliminar"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </div>
              </div>
              {item.hilos.length > 0 ? (
                <ul className="mt-3 space-y-2 border-t border-border pt-3">
                  {item.hilos.map((hilo) => (
                    <li
                      key={hilo.id}
                      className="group/hilo rounded border border-border/70 bg-surface px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-ink">
                            {hilo.titulo}
                          </p>
                          <p className="text-xs text-muted">
                            {new Date(hilo.fechaRegistrada).toLocaleString(
                              'es-CO',
                            )}
                          </p>
                          <Etiquetas tags={hilo.etiquetas} />
                          {hilo.observaciones ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                              {hilo.observaciones}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {hilo.recordatorioAt ? (
                            <p className="text-xs font-bold text-accent">
                              Recordatorio:{' '}
                              {formatReminderShort(hilo.recordatorioAt)}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            className="grid h-7 w-7 place-items-center rounded text-danger opacity-0 transition-opacity group-hover/hilo:opacity-100 focus-visible:opacity-100"
                            aria-label="Eliminar respuesta"
                            title="Eliminar"
                            onClick={() => handleDeleteHilo(item.id, hilo.id)}
                          >
                            <Trash2 size={15} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {modal ? (
        <InteraccionFormModal
          mode={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      ) : null}
    </section>
  );
}
