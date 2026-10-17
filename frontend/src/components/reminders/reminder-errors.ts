import { ApiError } from '../../modules/auth/types';

const GENERIC = 'No se pudo completar la acción. Intenta de nuevo.';

const BY_CODE: Record<string, string> = {
  VALIDATION_ERROR: 'La fecha del recordatorio debe ser futura.',
  FORBIDDEN: 'Solo el responsable puede gestionar este recordatorio.',
  CONFLICT: 'Este recordatorio ya fue realizado o cancelado.',
  NOT_FOUND: 'El recordatorio ya no existe.',
};

/** Spanish copy for the user. The server `message` is only written to the console. */
export function reminderErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    console.error(error.message);
    return (error.code && BY_CODE[error.code]) || GENERIC;
  }
  console.error(error instanceof Error ? error.message : error);
  return GENERIC;
}
