import {
  presupuestoAvanceCumple,
  presupuestoMontoAvance,
} from './presupuesto-avance';

describe('presupuestoMontoAvance', () => {
  it('treats null and undefined as 0', () => {
    expect(presupuestoMontoAvance(null)).toBe(0);
    expect(presupuestoMontoAvance(undefined)).toBe(0);
  });

  it('parses decimal strings before comparing', () => {
    expect(presupuestoMontoAvance('0.00')).toBe(0);
    expect(presupuestoMontoAvance('1500000.00')).toBe(1500000);
    expect(presupuestoAvanceCumple(true, '0.00')).toBe(false);
    expect(presupuestoAvanceCumple(true, '1500000.00')).toBe(true);
  });
});
