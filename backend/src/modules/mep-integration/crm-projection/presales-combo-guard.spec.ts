import { BusinessMilestone, ProcessingStatus } from '../domain/enums';
import { comboKey, isSolicitudRechazada } from './presales-combo-guard';

describe('presales-combo-guard', () => {
  it('iguala combos aunque el orden de servicios cambie', () => {
    expect(
      comboKey([
        { service: 'FINANCIAL_DESIGN', dependency: 'NONE' },
        { service: 'TECHNICAL_DESIGN', dependency: 'NONE' },
      ]),
    ).toBe(
      comboKey([
        { service: 'TECHNICAL_DESIGN', dependency: 'NONE' },
        { service: 'FINANCIAL_DESIGN', dependency: 'NONE' },
      ]),
    );
  });

  it('distingue simultáneo de secuencial', () => {
    const simultaneous = comboKey([
      { service: 'TECHNICAL_DESIGN', dependency: 'NONE' },
      { service: 'FINANCIAL_DESIGN', dependency: 'NONE' },
    ]);
    const sequential = comboKey([
      { service: 'TECHNICAL_DESIGN', dependency: 'NONE' },
      { service: 'FINANCIAL_DESIGN', dependency: 'TECHNICAL_DESIGN' },
    ]);
    expect(simultaneous).not.toBe(sequential);
  });

  it('solo Rechazada (acuse REJECTED/QUARANTINED sin cierre) habilita otra', () => {
    expect(
      isSolicitudRechazada({
        estado: { hito: null },
        pista_tecnica: [],
        polling_status: null,
      }),
    ).toBe(false);

    expect(
      isSolicitudRechazada({
        estado: { hito: BusinessMilestone.INTERACTION_RECEIVED },
        pista_tecnica: [{ processing_status: ProcessingStatus.ACCEPTED }],
        polling_status: ProcessingStatus.ACCEPTED,
      }),
    ).toBe(false);

    expect(
      isSolicitudRechazada({
        estado: { hito: BusinessMilestone.INTERACTION_COMPLETED },
        pista_tecnica: [{ processing_status: ProcessingStatus.REJECTED }],
        polling_status: ProcessingStatus.REJECTED,
      }),
    ).toBe(false);

    expect(
      isSolicitudRechazada({
        estado: { hito: null },
        pista_tecnica: [{ processing_status: ProcessingStatus.REJECTED }],
        polling_status: ProcessingStatus.REJECTED,
      }),
    ).toBe(true);

    expect(
      isSolicitudRechazada({
        estado: { hito: null },
        pista_tecnica: [],
        polling_status: ProcessingStatus.QUARANTINED,
      }),
    ).toBe(true);
  });
});
