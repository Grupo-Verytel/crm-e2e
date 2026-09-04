import { MAX_BODY_BYTES, mepJsonBodyParser } from './mep-body-limit';

describe('parser de cuerpo del contrato — §10.3', () => {
  it('§10.3: el límite es de 256 KB', () => {
    expect(MAX_BODY_BYTES).toBe(256 * 1024);
  });

  /**
   * Regresión real: `express.json()` devuelve una función llamada
   * `jsonParser`. Nest decide si monta su parser global comparando ese nombre
   * (`ExpressAdapter.isMiddlewareApplied`), así que montar uno con ese nombre
   * —aunque sea sobre `/v1`— hace que Nest NO registre el suyo y todo el CRM
   * fuera del contrato se queda sin body parseado: cualquier POST responde
   * 400 por DTO vacío.
   */
  it('no se llama `jsonParser`, o Nest no montaría su parser global', () => {
    expect(mepJsonBodyParser().name).not.toBe('jsonParser');
  });

  it('se identifica como el parser del contrato', () => {
    expect(mepJsonBodyParser().name).toBe('mepJsonParser');
  });

  it('sigue siendo un middleware de Express de 3 argumentos', () => {
    expect(mepJsonBodyParser()).toHaveLength(3);
  });
});
