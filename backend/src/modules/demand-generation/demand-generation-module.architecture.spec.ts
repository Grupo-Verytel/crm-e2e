import { readFileSync } from 'fs';
import { join } from 'path';

describe('Demand generation module architecture', () => {
  it('EARS-DEM-16: defines IcpScoreCalculatorPort without implementing scoring', () => {
    const portSource = readFileSync(
      join(__dirname, 'ports/icp-score-calculator.port.ts'),
      'utf8',
    );
    const leadsServiceSource = readFileSync(
      join(__dirname, 'services/leads.service.ts'),
      'utf8',
    );

    expect(portSource).toContain('interface IcpScoreCalculatorPort');
    expect(portSource).toContain('calculateIcpScore');
    expect(leadsServiceSource).not.toContain('calculateIcpScore');
    expect(leadsServiceSource).toContain('persistIcpScore');
  });

  it('EARS-DEM-18: module does not import AuditWriterService directly', () => {
    const moduleSource = readFileSync(
      join(__dirname, 'demand-generation.module.ts'),
      'utf8',
    );

    expect(moduleSource).not.toContain('AuditWriterService');
  });
});
