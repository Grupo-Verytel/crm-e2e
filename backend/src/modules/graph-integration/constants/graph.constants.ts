/**
 * Constantes de la integración con Microsoft Graph.
 *
 * Reutiliza la configuración del toolkit interno `MicrosoftGraph`
 * (Node + Express) que ya opera contra el tenant: mismos dominios de
 * usuarios, misma zona horaria y las salas registradas como recurso.
 */

export const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export const GRAPH_LOGIN_BASE_URL = 'https://login.microsoftonline.com';

export const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

/** Dominios de correo de la organización (Verytel y Frisson). */
export const GRAPH_ORG_DOMAINS = ['frisson.net.co', 'grupoverytel.com'];

export const GRAPH_DEFAULT_TIMEZONE = 'America/Bogota';

/** Intervalo (minutos) de la vista de disponibilidad de `getSchedule`. */
export const GRAPH_AVAILABILITY_INTERVAL = 30;

export type KickoffRoom = {
  /** Etiqueta usada por el frontend (`KickoffSalaVerytel`). */
  id: string;
  nombre: string;
  email: string;
};

/** Salas de reunión de Verytel disponibles para el Kickoff. */
export const KICKOFF_ROOMS: KickoffRoom[] = [
  {
    id: 'Sala Marte',
    nombre: 'Sala Marte',
    email: 'sala_marte@grupoverytel.com',
  },
  {
    id: 'Sala Júpiter',
    nombre: 'Sala Júpiter',
    email: 'sala_jupiter@grupoverytel.com',
  },
];

export function findKickoffRoom(idOrEmail: string): KickoffRoom | undefined {
  const needle = idOrEmail.trim().toLowerCase();
  return KICKOFF_ROOMS.find(
    (room) =>
      room.id.toLowerCase() === needle || room.email.toLowerCase() === needle,
  );
}
