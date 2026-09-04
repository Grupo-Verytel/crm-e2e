import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PmoCreateProjectPayload } from '../dtos/create-pmo-project.dto';
import { PmoApiClient } from './pmo-api.client';

const OUV_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

const PAYLOAD: PmoCreateProjectPayload = {
  PRO_CNAME: 'Red WAN',
  PRO_DASSIGNMENT: '2026-08-22T00:00:00.000Z',
  PRO_DSTART: '2026-09-01T00:00:00.000Z',
  PRO_DEND: '2027-03-01T00:00:00.000Z',
  OUV_ID,
};

function buildClient(config: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    PMO_API_BASE_URL: 'http://pmo.local',
    PMO_API_KEY: 'clave',
    ...config,
  };

  return new PmoApiClient({
    get: (key: string) => values[key],
  } as unknown as ConfigService);
}

function mockFetch(response: Partial<Response>): jest.Mock {
  const fn = jest.fn().mockResolvedValue(response);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('PmoApiClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends the API key and returns the PRO_NCODE assigned by the PMO', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ PRO_NCODE: 123 }),
    });

    await expect(buildClient().createProject(PAYLOAD)).resolves.toEqual({
      PRO_NCODE: 123,
    });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://pmo.local/api/projects');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'x-api-key': 'clave' });
    expect(JSON.parse(init.body as string)).toEqual(PAYLOAD);
  });

  it('maps the PMO duplicate-OUV 409 to a conflict', async () => {
    mockFetch({ ok: false, status: 409 });

    await expect(buildClient().createProject(PAYLOAD)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('maps a rejected payload (400) to 422 — the defect is on the CRM side', async () => {
    mockFetch({
      ok: false,
      status: 400,
      text: () => Promise.resolve('{"error":"Body inválido"}'),
    });

    await expect(buildClient().createProject(PAYLOAD)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('maps any other PMO failure to 502', async () => {
    mockFetch({ ok: false, status: 500 });

    await expect(buildClient().createProject(PAYLOAD)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps an unknown OUV on a read to 404', async () => {
    mockFetch({ ok: false, status: 404 });

    await expect(buildClient().getExecution(OUV_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('puts the ouvId on the query string of the read endpoints', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ouvId: OUV_ID }),
    });

    await buildClient().getStateHistory(OUV_ID);

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toBe(
      `http://pmo.local/api/projects/state-history?ouvId=${OUV_ID}`,
    );
  });

  it('fails closed when the integration is not configured', async () => {
    const fetchMock = mockFetch({ ok: true, status: 201 });

    await expect(
      buildClient({ PMO_API_KEY: undefined }).createProject(PAYLOAD),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports the PMO as unavailable when the request itself fails', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    await expect(buildClient().getExecution(OUV_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
