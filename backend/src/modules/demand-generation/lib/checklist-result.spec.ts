import {
  allChecklistCriteriaMet,
  computeChecklistResult,
  missingChecklistCriteria,
} from './checklist-result';
import { ChecklistResultado } from '../models/enums/checklist.enums';

const allTrue = {
  criterioSectorObjetivo: true,
  criterioNecesidadPortafolio: true,
  criterioAccesoDecisor: true,
  criterioPresupuestoIndicios: true,
};

describe('Checklist result (DG-13)', () => {
  it('is Calificado only when the 4 criteria are true', () => {
    expect(computeChecklistResult(allTrue)).toBe(ChecklistResultado.Calificado);
    expect(allChecklistCriteriaMet(allTrue)).toBe(true);
  });

  it('is NoCalificado when any criterion is false', () => {
    const partial = { ...allTrue, criterioAccesoDecisor: false };
    expect(computeChecklistResult(partial)).toBe(
      ChecklistResultado.NoCalificado,
    );
    expect(allChecklistCriteriaMet(partial)).toBe(false);
  });

  it('reports the specific missing criteria', () => {
    const partial = {
      ...allTrue,
      criterioAccesoDecisor: false,
      criterioPresupuestoIndicios: false,
    };
    expect(missingChecklistCriteria(partial)).toEqual([
      'criterio_acceso_decisor',
      'criterio_presupuesto_indicios',
    ]);
  });
});
