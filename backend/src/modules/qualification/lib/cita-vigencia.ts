/** SQL citas are wall-clock America/Bogota (UTC−05:00, no DST). */
const BOGOTA_OFFSET = '-05:00';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** DATEONLY from MySQL may arrive as a string or as a Date at UTC midnight. */
export function citaFechaPart(fecha: unknown): string {
  if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    return `${fecha.getUTCFullYear()}-${pad(fecha.getUTCMonth() + 1)}-${pad(fecha.getUTCDate())}`;
  }
  return String(fecha ?? '').slice(0, 10);
}

export function citaHoraPart(hora: unknown): string {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(hora ?? '').trim());
  if (!match) {
    return '';
  }
  return `${match[1]}:${match[2]}:${match[3] ?? '00'}`;
}

/** Instant of the cita start, interpreted in America/Bogota. */
export function citaStartsAt(fecha: unknown, hora: unknown): Date {
  const datePart = citaFechaPart(fecha);
  const timePart = citaHoraPart(hora);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !timePart) {
    return new Date(NaN);
  }
  return new Date(`${datePart}T${timePart}${BOGOTA_OFFSET}`);
}

/**
 * A cita is vigente when its start is now or later in America/Bogota.
 * There is no Cancelada state on sql_citas; a missing row is not vigente.
 */
export function isCitaVigente(
  fecha: unknown,
  hora: unknown,
  now: Date = new Date(),
): boolean {
  const start = citaStartsAt(fecha, hora);
  if (Number.isNaN(start.getTime())) {
    return false;
  }
  return start.getTime() >= now.getTime();
}
