import {
  emptyCitaContacto,
  MAX_CITA_CONTACTOS,
  type CitaContactoInput,
} from '../lib/cita-contactos';
import { ghostButtonClass, inputClass, labelClass } from './ui';

export function CitaContactosFields({
  contacts,
  onChange,
}: {
  contacts: CitaContactoInput[];
  onChange: (next: CitaContactoInput[]) => void;
}) {
  function update(index: number, patch: Partial<CitaContactoInput>) {
    onChange(
      contacts.map((contacto, current) =>
        current === index ? { ...contacto, ...patch } : contacto,
      ),
    );
  }

  return (
    <fieldset className="space-y-3 sm:col-span-2">
      <legend className={labelClass}>Contactos de la cita</legend>
      {contacts.map((contacto, index) => (
        <div
          key={index}
          className="space-y-2 rounded border border-border bg-bg p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-ink">
              {index === 0 ? 'Contacto principal' : `Contacto ${index + 1}`}
            </p>
            {index > 0 ? (
              <button
                type="button"
                className="text-xs font-bold text-accent"
                onClick={() =>
                  onChange(contacts.filter((_, current) => current !== index))
                }
              >
                Quitar
              </button>
            ) : null}
          </div>
          <div>
            <label className={labelClass} htmlFor={`sql-cita-nombre-${index}`}>
              Nombre
            </label>
            <input
              id={`sql-cita-nombre-${index}`}
              value={contacto.nombre}
              onChange={(event) => update(index, { nombre: event.target.value })}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`sql-cita-email-${index}`}>
              Correo
            </label>
            <input
              id={`sql-cita-email-${index}`}
              type="email"
              value={contacto.email}
              onChange={(event) => update(index, { email: event.target.value })}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`sql-cita-telefono-${index}`}>
              Teléfono
            </label>
            <input
              id={`sql-cita-telefono-${index}`}
              type="tel"
              value={contacto.telefono}
              onChange={(event) =>
                update(index, { telefono: event.target.value })
              }
              className={inputClass}
              required
            />
          </div>
        </div>
      ))}
      {contacts.length < MAX_CITA_CONTACTOS ? (
        <button
          type="button"
          className={ghostButtonClass}
          onClick={() => onChange([...contacts, emptyCitaContacto()])}
        >
          + Agregar contacto
        </button>
      ) : null}
    </fieldset>
  );
}
