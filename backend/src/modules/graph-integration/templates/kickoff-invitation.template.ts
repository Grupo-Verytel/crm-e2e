/**
 * Cuerpo HTML de la invitación de kickoff que se envía por Microsoft Graph.
 *
 *
 * Restricciones de Outlook: sin CSS externo ni `<style>` confiable, así que el
 * diseño va en tablas con estilos en línea. Todo valor que viene del usuario
 * pasa por `escapeHtml`: el cuerpo se envía como HTML.
 */

const COLORS = {
  brand: '#0033A0',
  header: '#B55802',
  onHeader: '#FFFFFF',
  accent: '#F88702',
  ink: '#1D1D1B',
  muted: '#6B6B6B',
  surface: '#F5F7FB',
  border: '#E3E7EF',
} as const;

const FONT = "'Segoe UI', Arial, Helvetica, sans-serif";

export type KickoffInvitationData = {
  subject: string;
  /** Hora local del tenant `YYYY-MM-DDTHH:mm[:ss]`, tal como la recibe Graph. */
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  consecutivo?: string | null;
  proyecto?: string | null;
  cliente?: string | null;
  organizerName?: string | null;
  locationName?: string | null;
  isOnlineMeeting: boolean;
  joinUrl?: string | null;
  attendeeNames: string[];
  observaciones?: string | null;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Fecha legible en español sin conversión de zona: el valor ya es hora local
 * del tenant, así que se formatea tal cual (se trata como UTC solo para que
 * `Intl` no le aplique el offset del servidor).
 */
export function formatFechaReunion(startDateTime: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(startDateTime);
  if (!match) return startDateTime;
  const [, y, m, d] = match.map(Number);
  const texto = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Nombre legible de la zona horaria; el id IANA se deja si no se conoce. */
function zonaLabel(timeZone: string): string {
  return /bogota|SA Pacific/i.test(timeZone) ? 'hora Colombia' : timeZone;
}

function hora(dateTime: string): string {
  return /T(\d{2}:\d{2})/.exec(dateTime)?.[1] ?? '';
}

function modalidad(data: KickoffInvitationData): string {
  const lugar = data.locationName?.trim();
  if (data.isOnlineMeeting && lugar) return `Presencial (${lugar}) y Teams`;
  if (data.isOnlineMeeting) return 'Virtual · Microsoft Teams';
  return lugar ? `Presencial · ${lugar}` : 'Presencial';
}

function fila(label: string, value: string | null | undefined): string {
  if (!value?.trim()) return '';
  return `
          <tr>
            <td style="padding:6px 0;width:150px;vertical-align:top;font-family:${FONT};font-size:13px;color:${COLORS.muted};">${escapeHtml(label)}</td>
            <td style="padding:6px 0;vertical-align:top;font-family:${FONT};font-size:14px;font-weight:bold;color:${COLORS.ink};">${escapeHtml(value.trim())}</td>
          </tr>`;
}

function seccion(titulo: string, contenido: string): string {
  return `
      <tr>
        <td style="padding:20px 28px 0 28px;">
          <p style="margin:0 0 8px 0;font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;color:${COLORS.brand};">${escapeHtml(titulo)}</p>
          ${contenido}
        </td>
      </tr>`;
}

export function renderKickoffInvitationHtml(
  data: KickoffInvitationData,
): string {
  const fecha = formatFechaReunion(data.startDateTime);
  const horario = `${hora(data.startDateTime)} – ${hora(data.endDateTime)} (${zonaLabel(data.timeZone)})`;
  const encabezado = [data.consecutivo, data.proyecto]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(' · ');

  const detalles = `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${fila('Proyecto', data.proyecto)}
            ${fila('Cliente', data.cliente)}
            ${fila('Oportunidad', data.consecutivo)}
            ${fila('Fecha', fecha)}
            ${fila('Horario', horario)}
            ${fila('Modalidad', modalidad(data))}
            ${fila('Organiza', data.organizerName)}
          </table>`;

  const joinUrl = data.isOnlineMeeting ? data.joinUrl?.trim() : null;
  const unirseHtml = joinUrl
    ? `
          <tr>
            <td style="padding:22px 28px 0 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="${COLORS.header}" style="background-color:${COLORS.header};border-radius:4px;">
                    <a href="${escapeHtml(joinUrl)}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:bold;color:${COLORS.onHeader};text-decoration:none;">Unirse a la reunión de Teams</a>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${COLORS.muted};">
                ¿No funciona el botón? <a href="${escapeHtml(joinUrl)}" target="_blank" style="color:${COLORS.brand};">Abrir el enlace de la reunión</a>
              </p>
            </td>
          </tr>`
    : '';

  const invitados = data.attendeeNames.map((n) => n.trim()).filter(Boolean);
  const invitadosHtml = invitados.length
    ? `<p style="margin:0;font-family:${FONT};font-size:14px;line-height:22px;color:${COLORS.ink};">${invitados
        .map(escapeHtml)
        .join(' · ')}</p>`
    : '';

  const observaciones = data.observaciones?.trim();
  const observacionesHtml = observaciones
    ? `<div style="padding:12px 14px;background-color:${COLORS.surface};border-left:3px solid ${COLORS.accent};font-family:${FONT};font-size:14px;line-height:21px;color:${COLORS.ink};">${escapeHtml(
        observaciones,
      ).replace(/\r?\n/g, '<br>')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#FFFFFF;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF;">
    <tr>
      <td align="left" style="padding:8px 0;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border:1px solid ${COLORS.border};">
          <tr>
            <td bgcolor="${COLORS.header}" style="background-color:${COLORS.header};padding:22px 28px;">
              <p style="margin:0;font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${COLORS.onHeader};">Kickoff de proyecto</p>
              <p style="margin:6px 0 0 0;font-family:${FONT};font-size:20px;font-weight:bold;line-height:26px;color:${COLORS.onHeader};">${escapeHtml(data.subject)}</p>
              ${encabezado ? `<p style="margin:6px 0 0 0;font-family:${FONT};font-size:13px;color:${COLORS.onHeader};">${escapeHtml(encabezado)}</p>` : ''}
            </td>
          </tr>
          <tr><td bgcolor="${COLORS.brand}" style="background-color:${COLORS.brand};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:22px 28px 0 28px;font-family:${FONT};font-size:14px;line-height:22px;color:${COLORS.ink};">
              Te invitamos a la reunión de inicio del proyecto. En esta sesión alineamos
              alcance, cronograma y responsables antes de arrancar la ejecución.
            </td>
          </tr>
          ${unirseHtml}
          ${seccion('Detalles', detalles)}
          ${invitadosHtml ? seccion('Participantes', invitadosHtml) : ''}
          ${observacionesHtml ? seccion('Observaciones', observacionesHtml) : ''}
          <tr>
            <td style="padding:24px 28px 20px 28px;">
              <p style="margin:0;padding-top:14px;border-top:1px solid ${COLORS.border};font-family:${FONT};font-size:12px;line-height:18px;color:${COLORS.muted};">
                Enviado desde CRM Frisson · Grupo Verytel
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
