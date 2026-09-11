import { ApiError } from '../types';

export function getFormErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'EMAIL_CONFLICT') {
      return 'Ese correo ya está registrado. Usa otro correo.';
    }
    if (error.code === 'ROLE_NAME_CONFLICT') {
      return 'Ya existe un rol con ese nombre. Usa otro nombre.';
    }
    return error.message;
  }

  return fallback;
}
