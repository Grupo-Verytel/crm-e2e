import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ModalShell } from '../../demand-generation/components/ModalShell';
import {
  createDefaultMeetingAttendee,
  listDefaultMeetingAttendees,
  readApiErrorMessages,
  removeDefaultMeetingAttendee,
  updateDefaultMeetingAttendee,
  type DefaultMeetingAttendee,
} from '../api/default-meeting-attendees-api';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

const ACTIVE_TONE: Record<'Activo' | 'Inactivo', string> = {
  Activo: 'border-turquoise text-ink',
  Inactivo: 'border-border text-muted',
};

const EMPTY_LIST =
  'No hay invitados por defecto. Las citas se agendarán sin invitados adicionales.';

function bySortOrder(rows: DefaultMeetingAttendee[]): DefaultMeetingAttendee[] {
  return [...rows].sort(
    (left, right) =>
      left.sort_order - right.sort_order ||
      left.email.localeCompare(right.email),
  );
}

function attendeeTitle(row: Pick<DefaultMeetingAttendee, 'name' | 'email'>): string {
  const name = row.name?.trim();
  return name ? name : row.email;
}

function ErrorLines({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }
  if (messages.length === 1) {
    return (
      <p className="text-sm text-danger" role="alert">
        {messages[0]}
      </p>
    );
  }
  return (
    <ul className="list-disc space-y-1 pl-4 text-sm text-danger" role="alert">
      {messages.map((message, index) => (
        <li key={`${index}-${message}`}>{message}</li>
      ))}
    </ul>
  );
}

export function DefaultMeetingAttendeesModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [items, setItems] = useState<DefaultMeetingAttendee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string[] | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await listDefaultMeetingAttendees();
      setItems(bySortOrder(response.items));
    } catch (error) {
      setLoadError(
        readApiErrorMessages(error, 'No se pudo cargar la lista de invitados.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const nextEmail = email.trim();
    const nextName = name.trim();
    if (!nextEmail) {
      setFormError(['El correo no es válido.']);
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const created = await createDefaultMeetingAttendee({
        email: nextEmail,
        ...(nextName ? { name: nextName } : {}),
      });
      setItems((current) => bySortOrder([...current, created]));
      setEmail('');
      setName('');
    } catch (error) {
      setFormError(
        readApiErrorMessages(error, 'No se pudo agregar el invitado.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveName(row: DefaultMeetingAttendee) {
    setBusyId(row.default_meeting_attendee_id);
    setRowError((current) => {
      const next = { ...current };
      delete next[row.default_meeting_attendee_id];
      return next;
    });
    try {
      const updated = await updateDefaultMeetingAttendee(
        row.default_meeting_attendee_id,
        { name: editName.trim() ? editName.trim() : null },
      );
      setItems((current) =>
        bySortOrder(
          current.map((item) =>
            item.default_meeting_attendee_id === updated.default_meeting_attendee_id
              ? updated
              : item,
          ),
        ),
      );
      setEditingId(null);
    } catch (error) {
      setRowError((current) => ({
        ...current,
        [row.default_meeting_attendee_id]: readApiErrorMessages(
          error,
          'No se pudo guardar el nombre.',
        ),
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggle(row: DefaultMeetingAttendee) {
    setBusyId(row.default_meeting_attendee_id);
    setRowError((current) => {
      const next = { ...current };
      delete next[row.default_meeting_attendee_id];
      return next;
    });
    try {
      const updated = await updateDefaultMeetingAttendee(
        row.default_meeting_attendee_id,
        { is_active: !row.is_active },
      );
      setItems((current) =>
        current.map((item) =>
          item.default_meeting_attendee_id === updated.default_meeting_attendee_id
            ? updated
            : item,
        ),
      );
    } catch (error) {
      setRowError((current) => ({
        ...current,
        [row.default_meeting_attendee_id]: readApiErrorMessages(
          error,
          'No se pudo cambiar el estado.',
        ),
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(row: DefaultMeetingAttendee) {
    const label = attendeeTitle(row);
    if (!window.confirm(`¿Eliminar a ${label} de los invitados por defecto?`)) {
      return;
    }
    setBusyId(row.default_meeting_attendee_id);
    setRowError((current) => {
      const next = { ...current };
      delete next[row.default_meeting_attendee_id];
      return next;
    });
    try {
      await removeDefaultMeetingAttendee(row.default_meeting_attendee_id);
      setItems((current) =>
        current.filter(
          (item) =>
            item.default_meeting_attendee_id !== row.default_meeting_attendee_id,
        ),
      );
      if (editingId === row.default_meeting_attendee_id) {
        setEditingId(null);
      }
    } catch (error) {
      setRowError((current) => ({
        ...current,
        [row.default_meeting_attendee_id]: readApiErrorMessages(
          error,
          'No se pudo eliminar el invitado.',
        ),
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ModalShell title="Invitados por defecto" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Se agregan automáticamente a toda cita agendada desde Asignar SQL. Los
          cambios no afectan citas ya agendadas.
        </p>

        <form className="space-y-3" onSubmit={(event) => void handleCreate(event)}>
          <div>
            <label htmlFor="default-attendee-email" className={labelClass}>
              Correo
            </label>
            <input
              id="default-attendee-email"
              type="email"
              required
              maxLength={180}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="default-attendee-name" className={labelClass}>
              Nombre
            </label>
            <input
              id="default-attendee-name"
              type="text"
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              autoComplete="off"
            />
          </div>
          {formError ? <ErrorLines messages={formError} /> : null}
          <div className="flex justify-end">
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={isSaving}
            >
              {isSaving ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </form>

        {isLoading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : loadError ? (
          <ErrorLines messages={loadError} />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">{EMPTY_LIST}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((row) => {
              const title = attendeeTitle(row);
              const showEmail = Boolean(row.name?.trim());
              const tone = row.is_active ? 'Activo' : 'Inactivo';
              const isBusy = busyId === row.default_meeting_attendee_id;
              const isEditing = editingId === row.default_meeting_attendee_id;
              return (
                <li
                  key={row.default_meeting_attendee_id}
                  className="rounded border border-border p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={`break-words text-sm font-bold ${
                          row.is_active ? 'text-ink' : 'text-muted'
                        }`}
                      >
                        {title}
                      </p>
                      {showEmail ? (
                        <p className="break-all text-xs text-muted">{row.email}</p>
                      ) : null}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-bold ${ACTIVE_TONE[tone]}`}
                    >
                      {tone}
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="mt-3 space-y-2">
                      <label
                        htmlFor={`edit-name-${row.default_meeting_attendee_id}`}
                        className={labelClass}
                      >
                        Nombre
                      </label>
                      <input
                        id={`edit-name-${row.default_meeting_attendee_id}`}
                        type="text"
                        maxLength={120}
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className={inputClass}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={primaryButtonClass}
                          disabled={isBusy}
                          onClick={() => void handleSaveName(row)}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          className={ghostButtonClass}
                          disabled={isBusy}
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={ghostButtonClass}
                        disabled={isBusy}
                        onClick={() => {
                          setEditingId(row.default_meeting_attendee_id);
                          setEditName(row.name ?? '');
                        }}
                      >
                        Editar nombre
                      </button>
                      <button
                        type="button"
                        className={ghostButtonClass}
                        disabled={isBusy}
                        onClick={() => void handleToggle(row)}
                      >
                        {row.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className={ghostButtonClass}
                        disabled={isBusy}
                        onClick={() => void handleRemove(row)}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                  {rowError[row.default_meeting_attendee_id] ? (
                    <div className="mt-2">
                      <ErrorLines
                        messages={rowError[row.default_meeting_attendee_id]}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cerrar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
