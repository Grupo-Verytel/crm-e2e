import { etagMatches } from '../domain/etag';
import { OuvContextController } from './ouv-context.controller';

describe('OuvContextController', () => {
  const body = {
    etag: '"ouv-context-OUV-0001-abc"',
    opportunity: {
      crm_opportunity_ref: 'OUV-0001',
      source_version: '4',
      etag: '"ouv-OUV-0001-v4"',
    },
    mep_interactions: { items: [] },
  };

  function controller() {
    const read = jest.fn(() => body);
    return {
      read,
      controller: new OuvContextController({ read } as never),
    };
  }

  it('responde 304 cuando If-None-Match coincide y no devuelve cuerpo', async () => {
    const harness = controller();
    const response = { setHeader: jest.fn(), status: jest.fn() };

    const result = await harness.controller.findOne(
      'OUV-0001',
      body.etag,
      response as never,
    );

    expect(result).toBeUndefined();
    expect(response.status).toHaveBeenCalledWith(304);
    expect(response.setHeader).toHaveBeenCalledWith('ETag', body.etag);
    expect(etagMatches(body.etag, body.etag)).toBe(true);
    expect(harness.read).toHaveBeenCalledTimes(1);
  });

  it('responde 200 con el mismo ETag en header y cuerpo cuando no coincide', async () => {
    const harness = controller();
    const response = { setHeader: jest.fn(), status: jest.fn() };

    const result = await harness.controller.findOne(
      'OUV-0001',
      '"otro"',
      response as never,
    );

    expect(result).toBe(body);
    expect(result?.etag).toBe(body.etag);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.setHeader).toHaveBeenCalledWith('ETag', body.etag);
  });
});
