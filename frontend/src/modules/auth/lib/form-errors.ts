import { ApiError } from '../types';

export function getFormErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'EMAIL_CONFLICT') {
      return 'Ese correo ya está registrado. Usa otro correo.';
    }
    return error.message;
  }

  return fallback;
}
