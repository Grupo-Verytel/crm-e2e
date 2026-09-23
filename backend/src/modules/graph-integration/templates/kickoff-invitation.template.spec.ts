import {
  escapeHtml,
  formatFechaReunion,
  renderKickoffInvitationHtml,
  type KickoffInvitationData,
} from './kickoff-invitation.template';

const base: KickoffInvitationData = {
  subject: 'Kickoff RENOVACION OPAIN',
  startDateTime: '2026-09-24T09:00:00',
  endDateTime: '2026-09-24T10:30:00',
  timeZone: 'America/Bogota',
  consecutivo: 'OUV-0245',
  proyecto: 'Renovación CCTV',
  cliente: 'OPAIN S.A.',
  organizerName: 'Eliseo Torres',
  locationName: null,
  isOnlineMeeting: true,
  attendeeNames: ['Ana Gómez', 'Luis Pérez'],
  observaciones: null,
};

describe('kickoff invitation template', () => {
  it('formats the local date in Spanish without shifting the day', () => {
    expect(formatFechaReunion('2026-09-24T00:30:00')).toBe(
      'Jueves, 24 de septiembre de 2026',
    );
  });

  it('renders project context, schedule and modality', () => {
    const html = renderKickoffInvitationHtml(base);
    expect(html).toContain('Kickoff RENOVACION OPAIN');
    expect(html).toContain('OUV-0245 · Renovación CCTV');
    expect(html).toContain('OPAIN S.A.');
    expect(html).toContain('09:00 – 10:30 (hora Colombia)');
    expect(html).toContain('Virtual · Microsoft Teams');
    expect(html).toContain('Ana Gómez · Luis Pérez');
    expect(html).toContain('Microsoft Teams está al final');
  });

  it('shows the room for hybrid meetings and omits the Teams note when in person only', () => {
    expect(
      renderKickoffInvitationHtml({ ...base, locationName: 'Sala Bogotá' }),
    ).toContain('Presencial (Sala Bogotá) y Teams');

    const presencial = renderKickoffInvitationHtml({
      ...base,
      isOnlineMeeting: false,
      locationName: 'Sala Bogotá',
    });
    expect(presencial).toContain('Presencial · Sala Bogotá');
    expect(presencial).not.toContain('Microsoft Teams está al final');
  });

  it('escapes user-provided values and keeps observation line breaks', () => {
    const html = renderKickoffInvitationHtml({
      ...base,
      proyecto: '<script>alert(1)</script>',
      observaciones: 'Traer planos\n<b>urgente</b>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Traer planos<br>&lt;b&gt;urgente&lt;/b&gt;');
  });

  it('omits empty optional sections', () => {
    const html = renderKickoffInvitationHtml({
      ...base,
      cliente: null,
      attendeeNames: [],
      observaciones: '   ',
    });
    expect(html).not.toContain('>Cliente<');
    expect(html).not.toContain('Participantes');
    expect(html).not.toContain('Observaciones');
  });

  it('escapeHtml covers quotes and ampersands', () => {
    expect(escapeHtml(`A&B "c" 'd'`)).toBe('A&amp;B &quot;c&quot; &#39;d&#39;');
  });
});
