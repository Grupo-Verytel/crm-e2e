import { idempotencyPathForResponsePublish } from './idempotency-scope';

describe('idempotencyPathForResponsePublish', () => {
  const path =
    '/v1/commercial-interactions/int_ouv0413_1/responses/qa20260925:int_ouv0413_1:response';

  it('includes response_version in the idempotency scope', () => {
    expect(idempotencyPathForResponsePublish(path, 1)).toBe(
      `${path}#response_version=1`,
    );
    expect(idempotencyPathForResponsePublish(path, 2)).toBe(
      `${path}#response_version=2`,
    );
  });

  it('allows the same Idempotency-Key across different versions', () => {
    expect(idempotencyPathForResponsePublish(path, 1)).not.toBe(
      idempotencyPathForResponsePublish(path, 2),
    );
  });
});
