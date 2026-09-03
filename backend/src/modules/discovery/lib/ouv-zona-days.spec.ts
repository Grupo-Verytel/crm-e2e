import { OuvResultado, OuvZona } from '../models/enums/ouv.enums';
import { computeOuvZonaDays, parseZonaValue } from './ouv-zona-days';

const createdAt = new Date('2026-08-12T14:37:00.000Z');
const now = new Date('2026-09-03T02:59:00.000Z');

describe('computeOuvZonaDays', () => {
  it('counts elapsed days in UNIVERSO while the OUV is still EnCurso there', () => {
    const days = computeOuvZonaDays({
      createdAt,
      zonaActual: OuvZona.Universo,
      resultado: OuvResultado.EnCurso,
      fechaCierre: null,
      now,
      transitions: [],
    });

    expect(days[OuvZona.Universo]).toBe(21);
    expect(days[OuvZona.EncimaFunnel]).toBe(0);
    expect(days[OuvZona.EnFunnel]).toBe(0);
    expect(days[OuvZona.MayorProbabilidad]).toBe(0);
  });

  it('splits days across zone transitions from audit history', () => {
    const days = computeOuvZonaDays({
      createdAt,
      zonaActual: OuvZona.MayorProbabilidad,
      resultado: OuvResultado.EnCurso,
      fechaCierre: null,
      now,
      transitions: [
        { at: new Date('2026-08-15T14:37:00.000Z'), to: OuvZona.EncimaFunnel },
        { at: new Date('2026-08-22T14:37:00.000Z'), to: OuvZona.EnFunnel },
        { at: new Date('2026-08-29T14:37:00.000Z'), to: OuvZona.MayorProbabilidad },
      ],
    });

    expect(days[OuvZona.Universo]).toBe(3);
    expect(days[OuvZona.EncimaFunnel]).toBe(7);
    expect(days[OuvZona.EnFunnel]).toBe(7);
    expect(days[OuvZona.MayorProbabilidad]).toBe(4);
  });

  it('stops Mayor Probabilidad at fecha_cierre when the OUV is Ganada', () => {
    const days = computeOuvZonaDays({
      createdAt,
      zonaActual: OuvZona.MayorProbabilidad,
      resultado: OuvResultado.Ganada,
      fechaCierre: new Date('2026-08-31T14:37:00.000Z'),
      now,
      transitions: [
        { at: new Date('2026-08-29T14:37:00.000Z'), to: OuvZona.MayorProbabilidad },
      ],
    });

    expect(days[OuvZona.Universo]).toBe(17);
    expect(days[OuvZona.MayorProbabilidad]).toBe(2);
  });

  it('stops the current zone at fecha_cierre when Descartada from UNIVERSO', () => {
    const days = computeOuvZonaDays({
      createdAt,
      zonaActual: OuvZona.Universo,
      resultado: OuvResultado.Descartada,
      fechaCierre: new Date('2026-08-14T14:37:00.000Z'),
      now,
      transitions: [],
    });

    expect(days[OuvZona.Universo]).toBe(2);
    expect(days[OuvZona.EncimaFunnel]).toBe(0);
  });

  it('adds time back to a previous zone after retroceso', () => {
    const days = computeOuvZonaDays({
      createdAt,
      zonaActual: OuvZona.Universo,
      resultado: OuvResultado.EnCurso,
      fechaCierre: null,
      now,
      transitions: [
        { at: new Date('2026-08-15T14:37:00.000Z'), to: OuvZona.EncimaFunnel },
        { at: new Date('2026-08-18T14:37:00.000Z'), to: OuvZona.Universo },
      ],
    });

    expect(days[OuvZona.Universo]).toBe(18);
    expect(days[OuvZona.EncimaFunnel]).toBe(3);
  });
});

describe('parseZonaValue', () => {
  it('parses JSON-serialized ENUM values from audit_log', () => {
    expect(parseZonaValue('"EN_FUNNEL"')).toBe(OuvZona.EnFunnel);
    expect(parseZonaValue('MAYOR_PROBABILIDAD')).toBe(OuvZona.MayorProbabilidad);
    expect(parseZonaValue('nope')).toBeNull();
  });
});
