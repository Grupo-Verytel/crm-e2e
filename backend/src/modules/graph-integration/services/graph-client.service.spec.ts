import { HttpException, Logger } from '@nestjs/common';
import { GraphClientService } from './graph-client.service';

function client(): GraphClientService {
  const values: Record<string, string> = {
    AZURE_TENANT_ID: 'tenant',
    AZURE_CLIENT_ID: 'client',
    AZURE_CLIENT_SECRET: 'secret-value',
  };
  return new GraphClientService({
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      const value = values[key];
      if (!value) {
        throw new Error(key);
      }
      return value;
    },
  } as never);
}

describe('GraphClientService.request', () => {
  const originalFetch = global.fetch;
  const logged: string[] = [];

  beforeEach(() => {
    logged.length = 0;
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((message: unknown) => {
        if (typeof message === 'string') {
          logged.push(message);
        }
      });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns the JSON body on success', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: 'token-test', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'evt-1' })),
      }) as never;

    const created = await client().request<{ id: string }>(
      'POST',
      '/users/a/events',
      {
        data: { subject: 'Recordatorio' },
      },
    );

    expect(created.id).toBe('evt-1');
  });

  it('returns undefined for an empty success body', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: 'token-test', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      }) as never;

    await expect(
      client().request('DELETE', '/users/a/events/evt-1'),
    ).resolves.toBeUndefined();
  });

  it('exposes Retry-After on a 429 without logging the token or the body', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: 'token-test', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'retry-after' ? '12' : null,
        },
        json: () =>
          Promise.resolve({
            error: { code: 'TooManyRequests', message: 'slow down' },
          }),
      }) as never;

    const error = await client()
      .request('POST', '/users/a/events', { data: { subject: 'Recordatorio' } })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    const httpError = error as HttpException;
    expect(httpError.getStatus()).toBe(429);
    expect(httpError.getResponse()).toEqual(
      expect.objectContaining({ retryAfter: '12', code: 'TooManyRequests' }),
    );
    const text = logged.join(' ');
    expect(text).not.toContain('token-test');
    expect(text).not.toContain('secret-value');
    expect(text).not.toContain('Recordatorio');
  });
});
