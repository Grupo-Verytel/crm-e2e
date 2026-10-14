import { InfluenciaEstado, InfluenciaTipo } from '../models/enums/ouv.enums';
import { evaluateGanadaClose } from './evaluate-ganada-close';

const V = InfluenciaEstado.Verde;
const R = InfluenciaEstado.Rojo;
const ECO = InfluenciaTipo.Economica;
const TEC = InfluenciaTipo.Tecnica;
const USU = InfluenciaTipo.Usuario;
const COACH = InfluenciaTipo.Coach;

function row(tipo: InfluenciaTipo, estado: InfluenciaEstado) {
  return { tipo, estado };
}

describe('evaluateGanadaClose', () => {
  it('accepts a confirmed budget above 0 with Usuario and Coach in Verde', () => {
    const result = evaluateGanadaClose({
      presupuestoConfirmado: true,
      presupuestoMonto: '1500.00',
      influences: [row(USU, V), row(COACH, V)],
    });
    expect(result.passed).toBe(true);
    expect(result.greenTypes).toEqual([USU, COACH]);
  });

  it('rejects a confirmed budget of 0', () => {
    const result = evaluateGanadaClose({
      presupuestoConfirmado: true,
      presupuestoMonto: '0.00',
      influences: [row(ECO, V), row(TEC, V)],
    });
    expect(result.passed).toBe(false);
    expect(result.presupuestoOk).toBe(false);
  });

  it('rejects an unconfirmed budget even when the amount is above 0', () => {
    const result = evaluateGanadaClose({
      presupuestoConfirmado: false,
      presupuestoMonto: 100,
      influences: [row(ECO, V), row(TEC, V)],
    });
    expect(result.passed).toBe(false);
    expect(result.presupuestoOk).toBe(false);
  });

  it('rejects a single green type', () => {
    const result = evaluateGanadaClose({
      presupuestoConfirmado: true,
      presupuestoMonto: 10,
      influences: [row(ECO, V), row(TEC, R)],
    });
    expect(result.passed).toBe(false);
    expect(result.greenTypes).toEqual([ECO]);
  });

  it('counts two Verdes of the same type as one type', () => {
    const result = evaluateGanadaClose({
      presupuestoConfirmado: true,
      presupuestoMonto: 10,
      influences: [row(ECO, V), row(ECO, V)],
    });
    expect(result.passed).toBe(false);
    expect(result.greenTypes).toEqual([ECO]);
  });

  it('does not let a Rojo cancel a Verde of the same type', () => {
    const result = evaluateGanadaClose({
      presupuestoConfirmado: true,
      presupuestoMonto: 10,
      influences: [row(ECO, V), row(ECO, R), row(USU, V)],
    });
    expect(result.passed).toBe(true);
    expect(result.greenTypes).toEqual([ECO, USU]);
  });
});
