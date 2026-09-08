import { Logger } from '@nestjs/common';

/**
 * Errores que InnoDB resuelve abortando una de las transacciones en conflicto.
 * El propio MySQL lo dice en el mensaje: «try restarting transaction».
 */
const CODIGOS_REINTENTABLES = new Set([
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
]);

type ErrorSequelize = {
  parent?: { code?: string };
  original?: { code?: string };
};

function esReintentable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { parent, original } = error as ErrorSequelize;
  const codigo = parent?.code ?? original?.code;
  return codigo !== undefined && CODIGOS_REINTENTABLES.has(codigo);
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const logger = new Logger('DeadlockRetry');

/**
 * Reintenta una transacción cuando InnoDB la aborta por deadlock.
 *
 * El expediente se guarda entero en cada `PUT`: bloquea la fila padre y
 * reemplaza cuatro tablas hijas. Dos guardados de la misma OUV a la vez —dos
 * personas, o una escribiendo rápido— pueden cruzar el orden en que toman los
 * bloqueos, y MySQL mata a una de las dos. Es un conflicto transitorio, no un
 * fallo del dato: reintentar resuelve.
 *
 * No cubre la saturación: si muchas escrituras se apilan sobre la misma fila,
 * las que esperan agotan `innodb_lock_wait_timeout` y fallan. Eso se ataca en
 * el cliente, no aquí — la pantalla agrupa las ediciones antes de enviar.
 */
export async function conReintentoPorDeadlock<T>(
  operacion: () => Promise<T>,
  opciones: { intentos?: number; esperaBaseMs?: number } = {},
): Promise<T> {
  const intentos = opciones.intentos ?? 4;
  const esperaBaseMs = opciones.esperaBaseMs ?? 60;

  for (let intento = 1; ; intento += 1) {
    try {
      return await operacion();
    } catch (error) {
      if (intento >= intentos || !esReintentable(error)) {
        throw error;
      }
      logger.warn(
        `Transacción abortada por bloqueo; reintento ${intento}/${intentos - 1}`,
      );
      // Espera creciente con ruido: si dos transacciones reintentan al mismo
      // tiempo vuelven a chocar, así que se desfasan a propósito.
      const espera = esperaBaseMs * intento * (0.5 + Math.random());
      await esperar(Math.round(espera));
    }
  }
}
