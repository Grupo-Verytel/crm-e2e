import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ServiceDependency,
  ServiceName,
  ServiceResultStatus,
} from './enums';
import {
  isDependencyAllowed,
  isServicePrecedenceSatisfied,
} from './service-dependency';

const FIXTURES = join(__dirname, '../../../../test/fixtures/intake');

interface RequestedService {
  service: ServiceName;
  dependency: ServiceDependency;
}

function loadCase(file: string): RequestedService[] {
  return JSON.parse(
    readFileSync(join(FIXTURES, file), 'utf8'),
  ) as RequestedService[];
}

const allValid = (services: RequestedService[]) =>
  services.every((s) => isDependencyAllowed(s.service, s.dependency));

describe('dependencia entre servicios — §4 / §7.6', () => {
  it('TS-SVC-01 / C-1: sólo técnico es válido', () => {
    expect(allValid(loadCase('services-c1-technical-only.json'))).toBe(true);
  });

  it('TS-SVC-02 / C-2: financiero directo sin fase técnica es válido', () => {
    expect(allValid(loadCase('services-c2-financial-direct.json'))).toBe(true);
  });

  it('TS-SVC-03 / C-3: técnico y financiero simultáneos e independientes es válido', () => {
    expect(allValid(loadCase('services-c3-parallel-independent.json'))).toBe(
      true,
    );
  });

  it('TS-SVC-04 / C-4: técnico seguido de financiero dependiente es válido', () => {
    expect(
      allValid(loadCase('services-c4-financial-depends-technical.json')),
    ).toBe(true);
  });

  it('TS-SVC-05 / C-NEG / INV-01 / INV-22: técnico dependiente de financiero es inválido', () => {
    const services = loadCase('services-cneg-inverted-dependency.json');

    expect(allValid(services)).toBe(false);
    expect(
      isDependencyAllowed(
        ServiceName.TECHNICAL_DESIGN,
        ServiceDependency.FINANCIAL_DESIGN,
      ),
    ).toBe(false);
  });

  it('INV-01: TECHNICAL_DESIGN solo admite dependency = NONE', () => {
    expect(
      isDependencyAllowed(ServiceName.TECHNICAL_DESIGN, ServiceDependency.NONE),
    ).toBe(true);
    expect(
      isDependencyAllowed(
        ServiceName.TECHNICAL_DESIGN,
        ServiceDependency.TECHNICAL_DESIGN,
      ),
    ).toBe(false);
  });

  it('INV-01: FINANCIAL_DESIGN no puede depender de sí mismo', () => {
    expect(
      isDependencyAllowed(
        ServiceName.FINANCIAL_DESIGN,
        ServiceDependency.FINANCIAL_DESIGN,
      ),
    ).toBe(false);
  });
});

describe('precedencia efectiva C-4 — técnico seguido de financiero', () => {
  const sequential = (
    technicalStatus: ServiceResultStatus,
    financialStatus: ServiceResultStatus,
  ) => [
    {
      service: ServiceName.TECHNICAL_DESIGN,
      status: technicalStatus,
      dependency: ServiceDependency.NONE,
    },
    {
      service: ServiceName.FINANCIAL_DESIGN,
      status: financialStatus,
      dependency: ServiceDependency.TECHNICAL_DESIGN,
    },
  ];

  it('rechaza financiero IN_PROGRESS mientras técnico sigue en RECEIVED', () => {
    const results = sequential(
      ServiceResultStatus.RECEIVED,
      ServiceResultStatus.IN_PROGRESS,
    );
    expect(isServicePrecedenceSatisfied(results[1], results)).toBe(false);
  });

  it('permite financiero RECEIVED mientras técnico está en RECEIVED', () => {
    const results = sequential(
      ServiceResultStatus.RECEIVED,
      ServiceResultStatus.RECEIVED,
    );
    expect(isServicePrecedenceSatisfied(results[1], results)).toBe(true);
  });

  it('rechaza financiero IN_PROGRESS mientras técnico sigue en IN_PROGRESS', () => {
    const results = sequential(
      ServiceResultStatus.IN_PROGRESS,
      ServiceResultStatus.IN_PROGRESS,
    );
    expect(isServicePrecedenceSatisfied(results[1], results)).toBe(false);
  });

  it('permite financiero IN_PROGRESS cuando técnico ya cerró (COMPLETED)', () => {
    const results = sequential(
      ServiceResultStatus.COMPLETED,
      ServiceResultStatus.IN_PROGRESS,
    );
    expect(isServicePrecedenceSatisfied(results[1], results)).toBe(true);
  });

  it('C-3 independiente: financiero IN_PROGRESS con dependency NONE aunque técnico RECEIVED', () => {
    const results = [
      {
        service: ServiceName.TECHNICAL_DESIGN,
        status: ServiceResultStatus.RECEIVED,
        dependency: ServiceDependency.NONE,
      },
      {
        service: ServiceName.FINANCIAL_DESIGN,
        status: ServiceResultStatus.IN_PROGRESS,
        dependency: ServiceDependency.NONE,
      },
    ];
    expect(isServicePrecedenceSatisfied(results[1], results)).toBe(true);
  });
});
