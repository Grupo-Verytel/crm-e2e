import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarInfluenciaDto } from './actualizar-influencia.dto';

/** Deterministic UUID v5 as produced by the pre-production load. */
const CONTACTO_OUV_ID_V5 = '13be4b7f-48ab-5d1a-8180-889e7c88f621';
const CONTACTO_OUV_ID_V4 = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

async function errorsFor(payload: Record<string, unknown>) {
  return validate(plainToInstance(ActualizarInfluenciaDto, payload));
}

describe('ActualizarInfluenciaDto', () => {
  it('accepts a UUID v5 contacto_ouv_id from the loaded data', async () => {
    await expect(
      errorsFor({
        estado: 'Verde',
        contacto_ouv_id: CONTACTO_OUV_ID_V5,
      }),
    ).resolves.toEqual([]);
  });

  it('accepts a UUID v4 contacto_ouv_id', async () => {
    await expect(
      errorsFor({
        estado: 'Rojo',
        contacto_ouv_id: CONTACTO_OUV_ID_V4,
      }),
    ).resolves.toEqual([]);
  });

  it('accepts evaluate-without-contact (null)', async () => {
    await expect(
      errorsFor({
        estado: 'Rojo',
        contacto_ouv_id: null,
      }),
    ).resolves.toEqual([]);
  });

  it('treats empty string as unassigned contact', async () => {
    await expect(
      errorsFor({
        estado: 'SinEvaluar',
        contacto_ouv_id: '',
      }),
    ).resolves.toEqual([]);
  });

  it('rejects a contacto_ouv_id that is not a UUID', async () => {
    const errors = await errorsFor({
      estado: 'Verde',
      contacto_ouv_id: 'contacto-1',
    });
    expect(errors.map((error) => error.property)).toEqual(['contacto_ouv_id']);
  });
});
