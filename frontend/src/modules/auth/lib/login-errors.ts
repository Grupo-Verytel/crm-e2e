import { ApiError } from '../types';

export function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.';
    }
    if (error.status === 403) {
      return 'Tu cuenta está inactiva. Contacta al administrador.';
    }
    return error.message;
  }

  return 'No se pudo iniciar sesión. Revisa tu conexión e intenta de nuevo.';
}
