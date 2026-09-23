import { isCitaVigente } from './cita-vigencia';

describe('isCitaVigente', () => {
  const now = new Date('2026-09-23T15:00:00.000Z');

  it('treats a start equal to now in America/Bogota as vigente', () => {
    expect(isCitaVigente('2026-09-23', '10:00', now)).toBe(true);
    expect(isCitaVigente('2026-09-23', '10:00:00', now)).toBe(true);
  });

  it('treats a start before now in America/Bogota as not vigente', () => {
    expect(isCitaVigente('2026-09-23', '09:59', now)).toBe(false);
    expect(isCitaVigente('2000-01-01', '08:00:00', now)).toBe(false);
  });

  it('treats a later Bogota wall time as vigente even when UTC is ahead', () => {
    expect(isCitaVigente('2026-09-23', '11:00', now)).toBe(true);
  });

  it('rejects a fecha or hora that cannot be parsed', () => {
    expect(isCitaVigente('no-es-fecha', '10:00', now)).toBe(false);
    expect(isCitaVigente('2026-09-23', 'tarde', now)).toBe(false);
  });
});
