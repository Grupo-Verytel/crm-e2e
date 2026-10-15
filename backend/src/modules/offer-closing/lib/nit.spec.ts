import { calcularDvNit, formatNit, parseNit } from './nit';

describe('nit', () => {
  it('calcula el DV con los pesos de la DIAN', () => {
    expect(calcularDvNit('901234567')).toBe('7');
    expect(calcularDvNit('800197268')).toBe('4'); // DIAN
    expect(calcularDvNit('860034313')).toBe('7'); // Davivienda
  });

  it('acepta puntos y espacios y separa base y DV', () => {
    expect(parseNit('901.234.567-7')).toEqual({ base: '901234567', dv: '7' });
    expect(parseNit(' 901234567 - 7 ')).toEqual({
      base: '901234567',
      dv: '7',
    });
  });

  it('rechaza un DV que no corresponde', () => {
    expect(parseNit('901234567-1')).toBeNull();
  });

  it('exige el guion antes del DV', () => {
    expect(parseNit('9012345677')).toBeNull();
  });

  it('rechaza bases muy cortas, muy largas o con letras', () => {
    expect(parseNit('12345-6')).toBeNull();
    expect(parseNit('1234567890123456-1')).toBeNull();
    expect(parseNit('90123A567-7')).toBeNull();
  });

  it('formatea base-DV', () => {
    expect(formatNit('901234567', '7')).toBe('901234567-7');
  });
});
