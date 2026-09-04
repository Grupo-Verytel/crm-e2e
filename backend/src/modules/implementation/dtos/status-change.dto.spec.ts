import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StatusChangeDto } from './status-change.dto';

/** Real payload produced by the PMO job (`jobs/notifyStateChanges.js`). */
const PMO_PAYLOAD = {
  referenceId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  newStatus: '1A',
  occurredAt: '2026-06-15T14:30:00.000Z',
  // UUID v5 derived from PSH_NCODE — deterministic, so retries repeat it.
  externalEventId: '2c6c6597-5c65-54c5-ad66-e0024ec47d07',
  comment: 'Red WAN Cota',
};

async function errorsFor(payload: Record<string, unknown>) {
  return validate(plainToInstance(StatusChangeDto, payload));
}

describe('StatusChangeDto', () => {
  it('accepts the payload the PMO actually sends, whose event id is a UUID v5', async () => {
    await expect(errorsFor(PMO_PAYLOAD)).resolves.toEqual([]);
  });

  it('accepts a push without the optional comment', async () => {
    const { comment: _comment, ...sinComentario } = PMO_PAYLOAD;
    await expect(errorsFor(sinComentario)).resolves.toEqual([]);
  });

  it('rejects a payload whose referenceId is not an OUV id', async () => {
    const errors = await errorsFor({ ...PMO_PAYLOAD, referenceId: 'SER-0001' });
    expect(errors.map((error) => error.property)).toEqual(['referenceId']);
  });

  it('rejects a status change without a timestamp', async () => {
    const errors = await errorsFor({ ...PMO_PAYLOAD, occurredAt: 'ayer' });
    expect(errors.map((error) => error.property)).toEqual(['occurredAt']);
  });
});
