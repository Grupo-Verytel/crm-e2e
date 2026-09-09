import {
  BusinessMilestone,
  ProcessingStatus,
  ResponseStatus,
} from '../domain/enums';
import {
  isSolicitudEnCurso,
  servicesOverlap,
} from './presales-combo-guard';

const tecnica = [{ service: 'TECHNICAL_DESIGN' }];
const financiera = [{ service: 'FINANCIAL_DESIGN' }];
const combinada = [
  { service: 'TECHNICAL_DESIGN' },
  { service: 'FINANCIAL_DESIGN' },
];

describe('presales-combo-guard', () => {
  it('Técnica en curso bloquea combinadas y deja Financiera libre', () => {
    expect(servicesOverlap(tecnica, tecnica)).toBe(true);
    expect(servicesOverlap(tecnica, combinada)).toBe(true);
    expect(servicesOverlap(tecnica, financiera)).toBe(false);
  });

  it('Financiera en curso bloquea combinadas y deja Técnica libre', () => {
    expect(servicesOverlap(financiera, financiera)).toBe(true);
    expect(servicesOverlap(financiera, combinada)).toBe(true);
    expect(servicesOverlap(financiera, tecnica)).toBe(false);
  });

  it('combinada en curso cubre todos los tipos', () => {
    expect(servicesOverlap(combinada, tecnica)).toBe(true);
    expect(servicesOverlap(combinada, financiera)).toBe(true);
    expect(servicesOverlap(combinada, combinada)).toBe(true);
  });

  it('Pendiente / Aceptado / En progreso siguen en curso; Aprobada y Rechazada no', () => {
    expect(
      isSolicitudEnCurso({
        estado: { hito: null },
        pista_tecnica: [],
        polling_status: null,
      }),
    ).toBe(true);

    expect(
      isSolicitudEnCurso({
        estado: { hito: BusinessMilestone.INTERACTION_RECEIVED },
        pista_tecnica: [{ processing_status: ProcessingStatus.ACCEPTED }],
        polling_status: ProcessingStatus.ACCEPTED,
      }),
    ).toBe(true);

    expect(
      isSolicitudEnCurso({
        estado: {
          hito: BusinessMilestone.ENGINEER_ASSIGNED,
          response_status: ResponseStatus.IN_PROGRESS,
        },
        pista_tecnica: [{ processing_status: ProcessingStatus.ACCEPTED }],
        polling_status: ProcessingStatus.ACCEPTED,
      }),
    ).toBe(true);

    expect(
      isSolicitudEnCurso({
        estado: {
          hito: BusinessMilestone.INTERACTION_COMPLETED,
          response_status: ResponseStatus.COMPLETED,
        },
        pista_tecnica: [{ processing_status: ProcessingStatus.ACCEPTED }],
        polling_status: ProcessingStatus.ACCEPTED,
      }),
    ).toBe(false);

    expect(
      isSolicitudEnCurso({
        estado: { hito: null },
        pista_tecnica: [{ processing_status: ProcessingStatus.REJECTED }],
        polling_status: ProcessingStatus.REJECTED,
      }),
    ).toBe(false);
  });
});
