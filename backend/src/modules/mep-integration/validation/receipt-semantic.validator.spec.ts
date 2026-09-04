import { readFileSync } from 'fs';
import { join } from 'path';
import { MepProblemException } from '../domain/mep-problem.exception';
import { CreateProcessingReceiptDto } from '../dtos/create-processing-receipt.dto';
import { ReceiptSemanticValidator } from './receipt-semantic.validator';

const FIXTURES = join(__dirname, '../../../../test/fixtures/receipts');

function fixture(name: string): CreateProcessingReceiptDto {
  return JSON.parse(
    readFileSync(join(FIXTURES, `${name}.json`), 'utf8'),
  ) as CreateProcessingReceiptDto;
}

function codeOf(run: () => void): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(MepProblemException);
    return (error as MepProblemException).code;
  }
  throw new Error('Se esperaba un rechazo semántico y no se produjo');
}

describe('validador semántico del acuse técnico — §6.4', () => {
  let validator: ReceiptSemanticValidator;

  beforeEach(() => {
    validator = new ReceiptSemanticValidator();
  });

  it('TS-RCP-01: el acuse ACCEPTED del brief es válido', () => {
    const payload = fixture('receipt-accepted');

    expect(() =>
      validator.validate(payload, {
        rawBody: payload,
        latestReceiptVersion: null,
      }),
    ).not.toThrow();
  });

  it('§6.4: el acuse DUPLICATE no exige reason_code', () => {
    const payload = fixture('receipt-duplicate');

    expect(() =>
      validator.validate(payload, {
        rawBody: payload,
        latestReceiptVersion: null,
      }),
    ).not.toThrow();
  });

  it('§6.4: QUARANTINED con reason_code es válido', () => {
    const payload = fixture('receipt-quarantined');

    expect(() =>
      validator.validate(payload, {
        rawBody: payload,
        latestReceiptVersion: null,
      }),
    ).not.toThrow();
  });

  it('TS-RCP-03: QUARANTINED sin reason_code → MISSING_REASON_CODE', () => {
    const payload = { ...fixture('receipt-quarantined'), reason_code: null };

    expect(
      codeOf(() =>
        validator.validate(payload, {
          rawBody: payload,
          latestReceiptVersion: null,
        }),
      ),
    ).toBe('MISSING_REASON_CODE');
  });

  it('§6.4: REJECTED sin reason_code → MISSING_REASON_CODE', () => {
    const payload = fixture('receipt-rejected-no-reason');

    expect(
      codeOf(() =>
        validator.validate(payload, {
          rawBody: payload,
          latestReceiptVersion: null,
        }),
      ),
    ).toBe('MISSING_REASON_CODE');
  });

  it('TS-RCP-07: receipt_version no monotónica → NON_MONOTONIC_VERSION', () => {
    const payload = fixture('receipt-accepted');

    expect(
      codeOf(() =>
        validator.validate(payload, {
          rawBody: payload,
          latestReceiptVersion: 3,
        }),
      ),
    ).toBe('NON_MONOTONIC_VERSION');
  });

  it('TS-LEAN-02 / INV-25: `excel_row_id` en el acuse → UNKNOWN_PROPERTY', () => {
    const payload = fixture('receipt-accepted');

    expect(
      codeOf(() =>
        validator.validate(payload, {
          rawBody: { ...payload, excel_row_id: 44 },
          latestReceiptVersion: null,
        }),
      ),
    ).toBe('UNKNOWN_PROPERTY');
  });
});
