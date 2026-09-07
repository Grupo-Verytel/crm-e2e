export enum InteractionTipo {
  Email = 'Email',
  Llamada = 'Llamada',
  Reunion = 'Reunion',
  Webinar = 'Webinar',
  Descarga = 'Descarga',
  VisitaWeb = 'VisitaWeb',
}

export enum InteractionCanal {
  Email = 'Email',
  Telefono = 'Telefono',
  WhatsApp = 'WhatsApp',
  LinkedIn = 'LinkedIn',
  Presencial = 'Presencial',
  Teams = 'Teams',
  GoogleMeet = 'GoogleMeet',
  Web = 'Web',
  Otro = 'Otro',
}

export enum InteractionResultado {
  Positivo = 'Positivo',
  Neutro = 'Neutro',
  Negativo = 'Negativo',
  SinRespuesta = 'SinRespuesta',
}

/** Allowed communication channels per interaction type. */
export const CANALES_POR_TIPO: Record<InteractionTipo, InteractionCanal[]> = {
  [InteractionTipo.Email]: [InteractionCanal.Email, InteractionCanal.LinkedIn],
  [InteractionTipo.Llamada]: [
    InteractionCanal.Telefono,
    InteractionCanal.WhatsApp,
  ],
  [InteractionTipo.Reunion]: [
    InteractionCanal.Presencial,
    InteractionCanal.Teams,
    InteractionCanal.GoogleMeet,
  ],
  [InteractionTipo.Webinar]: [InteractionCanal.Web],
  [InteractionTipo.Descarga]: [InteractionCanal.Web],
  [InteractionTipo.VisitaWeb]: [InteractionCanal.Web],
};

export function isCanalAllowedForTipo(
  tipo: InteractionTipo,
  canal: InteractionCanal,
): boolean {
  return (CANALES_POR_TIPO[tipo] ?? []).includes(canal);
}
