import { readFileSync } from 'fs';
import { join } from 'path';
import { MepProblemException } from '../domain/mep-problem.exception';
import { createMepValidationPipe } from '../validation/mep-validation.pipe';
import { PublishResponseDto } from './publish-response.dto';

const FIXTURES = join(__dirname, '../../../../test/fixtures/responses');

describe('PublishResponseDto — validación de contrato', () => {
  const pipe = createMepValidationPipe();

  async function validate(body: unknown): Promise<PublishResponseDto> {
    return pipe.transform(body, {
      type: 'body',
      metatype: PublishResponseDto,
    }) as Promise<PublishResponseDto>;
  }

  it('acepta un payload válido del fixture v3', async () => {
    const body = JSON.parse(
      readFileSync(join(FIXTURES, 'response-v3.json'), 'utf8'),
    );
    const dto = await validate(body);
    expect(dto.responded_by.ref).toBeTruthy();
  });

  it('responded_by ausente → 400 MALFORMED_REQUEST (no 503)', async () => {
    const body = JSON.parse(
      readFileSync(join(FIXTURES, 'response-v3.json'), 'utf8'),
    );
    delete (body as { responded_by?: unknown }).responded_by;

    let caught: unknown;
    try {
      await validate(body);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MepProblemException);
    const ex = caught as MepProblemException;
    expect(ex.code).toBe('MALFORMED_REQUEST');
    expect(ex.getStatus()).toBe(400);
  });
});
