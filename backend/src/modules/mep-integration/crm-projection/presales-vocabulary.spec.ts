import { ServiceDependency, ServiceHorizon } from '../domain/enums';
import { isDependencyAllowed } from '../domain/service-dependency';
import {
  ActivityPriority,
  COMBO_TO_SERVICES,
  PRIORITY_TO_HORIZON,
  ServiceCombo,
} from './presales-vocabulary';

describe('vocabulario UI → contrato — §14 Fase 3', () => {
  it('§3.1: todo horizonte emitido pertenece a la enumeración canónica', () => {
    const canonical = Object.values(ServiceHorizon) as string[];

    for (const horizon of Object.values(PRIORITY_TO_HORIZON)) {
      expect(canonical).toContain(horizon);
    }
  });

  it('SOMBRA se traduce a DEFERRED, no al inexistente SHADOW del diseño', () => {
    // El diseño de referencia usaba `SHADOW`, que el contrato rechaza con 422.
    expect(PRIORITY_TO_HORIZON[ActivityPriority.SOMBRA]).toBe(
      ServiceHorizon.DEFERRED,
    );
    expect(Object.values(PRIORITY_TO_HORIZON)).not.toContain('SHADOW');
  });

  it('ASAP se traduce a IMMEDIATE', () => {
    expect(PRIORITY_TO_HORIZON[ActivityPriority.ASAP]).toBe(
      ServiceHorizon.IMMEDIATE,
    );
  });

  it('§7.6: los combos cubren exactamente los 4 casos válidos C-1..C-4', () => {
    expect(Object.keys(COMBO_TO_SERVICES).sort()).toEqual(
      [
        ServiceCombo.FINANCIAL,
        ServiceCombo.TECHNICAL,
        ServiceCombo.TECHNICAL_AND_FINANCIAL,
        ServiceCombo.TECHNICAL_THEN_FINANCIAL,
      ].sort(),
    );
  });

  it('INV-01 / TS-SVC-05: ningún combo puede producir una dependencia invertida', () => {
    for (const [combo, services] of Object.entries(COMBO_TO_SERVICES)) {
      for (const service of services) {
        expect({
          combo,
          service: service.service,
          allowed: isDependencyAllowed(service.service, service.dependency),
        }).toEqual({ combo, service: service.service, allowed: true });
      }
    }
  });

  it('§4: cada combo declara entre 1 y 2 servicios, sin duplicados', () => {
    for (const services of Object.values(COMBO_TO_SERVICES)) {
      expect(services.length).toBeGreaterThanOrEqual(1);
      expect(services.length).toBeLessThanOrEqual(2);
      expect(new Set(services.map((s) => s.service)).size).toBe(
        services.length,
      );
    }
  });

  it('C-4 es el único combo con dependencia declarada', () => {
    const withDependency = Object.entries(COMBO_TO_SERVICES)
      .filter(([, services]) =>
        services.some((s) => s.dependency !== ServiceDependency.NONE),
      )
      .map(([combo]) => combo);

    expect(withDependency).toEqual([ServiceCombo.TECHNICAL_THEN_FINANCIAL]);
  });
});
