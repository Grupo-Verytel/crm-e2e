import {
  RouteStatus,
  ServiceName,
  ServiceOutcome,
  ServiceResultStatus,
} from '../domain/enums';
import {
  PRESALES_VIABILIDAD_ETIQUETAS,
  resolvePresalesViabilidad,
} from './viabilidad-preventa';

describe('resolvePresalesViabilidad — MEP outcome and route mapping', () => {
  const base = {
    service: ServiceName.TECHNICAL_DESIGN,
    status: ServiceResultStatus.IN_PROGRESS,
    entregablesCount: 0,
    routeStatus: null as RouteStatus | null,
    outcome: null as ServiceOutcome | null,
  };

  it('maps service outcome VIABLE', () => {
    expect(
      resolvePresalesViabilidad({
        ...base,
        outcome: ServiceOutcome.VIABLE,
      }),
    ).toEqual({
      codigo: 'SERVICIO_VIABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.SERVICIO_VIABLE,
    });
  });

  it('maps service outcome CONDITIONED as viable', () => {
    expect(
      resolvePresalesViabilidad({
        ...base,
        outcome: ServiceOutcome.CONDITIONED,
      }),
    ).toEqual({
      codigo: 'SERVICIO_VIABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.SERVICIO_VIABLE,
    });
  });

  it('maps service outcome NOT_VIABLE', () => {
    expect(
      resolvePresalesViabilidad({
        ...base,
        outcome: ServiceOutcome.NOT_VIABLE,
      }),
    ).toEqual({
      codigo: 'SERVICIO_NO_VIABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.SERVICIO_NO_VIABLE,
    });
  });

  it('maps service outcome PARTIAL as sin entregable', () => {
    expect(
      resolvePresalesViabilidad({
        ...base,
        outcome: ServiceOutcome.PARTIAL,
      }),
    ).toEqual({
      codigo: 'SERVICIO_SIN_ENTREGABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.SERVICIO_SIN_ENTREGABLE,
    });
  });

  it('maps route VIABLE for technical design when outcome is absent', () => {
    expect(
      resolvePresalesViabilidad({
        ...base,
        routeStatus: RouteStatus.VIABLE,
      }),
    ).toEqual({
      codigo: 'RUTA_VIABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.RUTA_VIABLE,
    });
  });

  it('maps route CONDITIONED as ruta viable', () => {
    expect(
      resolvePresalesViabilidad({
        ...base,
        routeStatus: RouteStatus.CONDITIONED,
      }),
    ).toEqual({
      codigo: 'RUTA_VIABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.RUTA_VIABLE,
    });
  });

  it('maps route NOT_VIABLE for technical design', () => {
    expect(
      resolvePresalesViabilidad({
        ...base,
        routeStatus: RouteStatus.NOT_VIABLE,
      }),
    ).toEqual({
      codigo: 'RUTA_NO_VIABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.RUTA_NO_VIABLE,
    });
  });

  it('ignores route status for financial design', () => {
    expect(
      resolvePresalesViabilidad({
        ...base,
        service: ServiceName.FINANCIAL_DESIGN,
        routeStatus: RouteStatus.VIABLE,
      }),
    ).toEqual({ codigo: null, etiqueta: null });
  });

  it('maps terminal completed without outcome or deliverables', () => {
    expect(
      resolvePresalesViabilidad({
        ...base,
        status: ServiceResultStatus.COMPLETED,
        entregablesCount: 0,
      }),
    ).toEqual({
      codigo: 'SERVICIO_SIN_ENTREGABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.SERVICIO_SIN_ENTREGABLE,
    });
  });

  it('outcome takes precedence over route status', () => {
    expect(
      resolvePresalesViabilidad({
        ...base,
        outcome: ServiceOutcome.VIABLE,
        routeStatus: RouteStatus.NOT_VIABLE,
      }),
    ).toEqual({
      codigo: 'SERVICIO_VIABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.SERVICIO_VIABLE,
    });
  });
});
