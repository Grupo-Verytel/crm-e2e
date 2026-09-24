import { InfluenciaEstado, InfluenciaTipo } from '../models/enums/ouv.enums';
import { evaluateInfluenceFilter } from './evaluate-influence-filter';

const V = InfluenciaEstado.Verde;
const R = InfluenciaEstado.Rojo;
const SE = InfluenciaEstado.SinEvaluar;
const ECO = InfluenciaTipo.Economica;
const TEC = InfluenciaTipo.Tecnica;
const FAB = InfluenciaTipo.Fabrica;
const USU = InfluenciaTipo.Usuario;
const COACH = InfluenciaTipo.Coach;

function row(tipo: InfluenciaTipo, estado: InfluenciaEstado) {
  return { tipo, estado };
}

describe('evaluateInfluenceFilter', () => {
  it('caso 1: dos Verdes del mismo tipo no cumplen', () => {
    const result = evaluateInfluenceFilter([
      row(ECO, V),
      row(ECO, V),
      row(TEC, SE),
    ]);
    expect(result.passed).toBe(false);
    expect(result.greenTypes).toEqual([ECO]);
    expect(result.required).toBe(2);
  });

  it('caso 2: Economica y Tecnica en Verde cumplen', () => {
    const result = evaluateInfluenceFilter([row(ECO, V), row(TEC, V)]);
    expect(result.passed).toBe(true);
    expect(result.greenTypes).toEqual([ECO, TEC]);
  });

  it('caso 3: un Rojo no anula el Verde del mismo tipo', () => {
    const result = evaluateInfluenceFilter([
      row(ECO, V),
      row(ECO, R),
      row(FAB, V),
    ]);
    expect(result.passed).toBe(true);
    expect(result.greenTypes).toEqual([ECO, FAB]);
  });

  it('caso 4: Usuario y Coach no cuentan', () => {
    const result = evaluateInfluenceFilter([
      row(USU, V),
      row(COACH, V),
      row(ECO, V),
    ]);
    expect(result.passed).toBe(false);
    expect(result.greenTypes).toEqual([ECO]);
  });

  it('caso 5: un solo tipo en Verde no cumple', () => {
    const result = evaluateInfluenceFilter([
      row(ECO, R),
      row(TEC, R),
      row(FAB, V),
    ]);
    expect(result.passed).toBe(false);
    expect(result.greenTypes).toEqual([FAB]);
  });

  it('caso 6: los tres tipos en Verde cumplen', () => {
    const result = evaluateInfluenceFilter([
      row(ECO, V),
      row(TEC, V),
      row(FAB, V),
    ]);
    expect(result.passed).toBe(true);
    expect(result.greenTypes).toEqual([ECO, TEC, FAB]);
  });

  it('caso 7: cinco Verdes de un solo tipo no cumplen', () => {
    const result = evaluateInfluenceFilter([
      row(ECO, V),
      row(ECO, V),
      row(ECO, V),
      row(ECO, V),
      row(ECO, V),
      row(TEC, SE),
    ]);
    expect(result.passed).toBe(false);
    expect(result.greenTypes).toEqual([ECO]);
    expect(result.required).toBe(2);
  });
});
