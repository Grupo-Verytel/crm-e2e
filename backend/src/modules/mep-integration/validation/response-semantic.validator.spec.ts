import { readFileSync } from 'fs';
import { join } from 'path';
import { BusinessMilestone } from '../domain/enums';
import { MepProblemException } from '../domain/mep-problem.exception';
import { PublishResponseDto } from '../dtos/publish-response.dto';
import {
  ResponseSemanticValidator,
  ResponseValidationContext,
} from './response-semantic.validator';

const FIXTURES = join(__dirname, '../../../../test/fixtures/responses');
const ROUTE_RESPONSE_ID = 'mep:int_20004:response';

function fixture(version: 1 | 2 | 3 | 4 | 5): PublishResponseDto {
  return JSON.parse(
    readFileSync(join(FIXTURES, `response-v${version}.json`), 'utf8'),
  ) as PublishResponseDto;
}

function context(
  overrides: Partial<ResponseValidationContext> = {},
  payload?: PublishResponseDto,
): ResponseValidationContext {
  return {
    routeResponseId: ROUTE_RESPONSE_ID,
    rawBody: payload ?? {},
    existingResponseId: null,
    currentVersion: null,
    currentMilestone: null,
    ...overrides,
  };
}

/** Captura el `code` del 422 emitido, o falla si no se emitió ninguno. */
function codeOf(run: () => void): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(MepProblemException);
    return (error as MepProblemException).code;
  }
  throw new Error('Se esperaba un rechazo semántico y no se produjo');
}

describe('validador semántico de respuestas — §7 / §9.3', () => {
  let validator: ResponseSemanticValidator;

  beforeEach(() => {
    validator = new ResponseSemanticValidator();
  });

  // ------------------------------------------------ secuencia maestra V1→V5

  describe('TS-VER-01 / AC-14: secuencia completa V1 → V5 de int_20004', () => {
    it('acepta los cinco hitos con un único response_id estable (INV-26)', () => {
      let currentVersion: number | null = null;
      let currentMilestone: BusinessMilestone | null = null;
      let existingResponseId: string | null = null;

      for (const v of [1, 2, 3, 4, 5] as const) {
        const payload = fixture(v);

        expect(() =>
          validator.validate(
            payload,
            context(
              { currentVersion, currentMilestone, existingResponseId },
              payload,
            ),
          ),
        ).not.toThrow();

        expect(payload.response_id).toBe(ROUTE_RESPONSE_ID);
        currentVersion = payload.response_version;
        currentMilestone = payload.business_milestone;
        existingResponseId = payload.response_id;
      }

      expect(currentVersion).toBe(5);
      expect(currentMilestone).toBe(BusinessMilestone.INTERACTION_COMPLETED);
    });

    it('TS-VER-02 / INV-17: route_capacity sigue en V2 en la versión 5 (relojes independientes)', () => {
      const v4 = fixture(4);
      const v5 = fixture(5);

      expect(v4.route_capacity?.version).toBe('V2');
      expect(v5.route_capacity?.version).toBe('V2');
      expect(v5.response_version).toBe(5);

      expect(() =>
        validator.validate(
          v5,
          context(
            {
              currentVersion: 4,
              currentMilestone: BusinessMilestone.ROUTE_CAPACITY_REGISTERED,
              existingResponseId: ROUTE_RESPONSE_ID,
            },
            v5,
          ),
        ),
      ).not.toThrow();
    });

    it('TS-VER-07 / P-08: la narrativa de V3 no contiene el texto de V1 ni de V2', () => {
      const v1 = fixture(1);
      const v2 = fixture(2);
      const v3 = fixture(3);

      expect(v3.narrative_note).not.toContain(v1.narrative_note as string);
      expect(v3.narrative_note).not.toContain(v2.narrative_note as string);
    });
  });

  // ------------------------------------------------------------- identidad

  it('TS-VER-05: response_id del body distinto al de la ruta → RESPONSE_ID_MISMATCH', () => {
    const payload = { ...fixture(1), response_id: 'mep:otro:response' };

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('RESPONSE_ID_MISMATCH');
  });

  it('TS-VER-06 / INV-26: response_id distinto para la misma interacción → RESPONSE_ID_NOT_STABLE', () => {
    const payload = fixture(2);

    expect(
      codeOf(() =>
        validator.validate(
          payload,
          context(
            {
              existingResponseId: 'mep:int_20004:otro-response',
              currentVersion: 1,
              currentMilestone: BusinessMilestone.INTERACTION_RECEIVED,
            },
            payload,
          ),
        ),
      ),
    ).toBe('RESPONSE_ID_NOT_STABLE');
  });

  // ------------------------------------------------------------ versionado

  it('TS-VER-03: response_version 3 cuando la actual es 4 → NON_MONOTONIC_VERSION', () => {
    const payload = fixture(3);

    expect(
      codeOf(() =>
        validator.validate(
          payload,
          context(
            {
              currentVersion: 4,
              currentMilestone: BusinessMilestone.ROUTE_CAPACITY_REGISTERED,
              existingResponseId: ROUTE_RESPONSE_ID,
            },
            payload,
          ),
        ),
      ),
    ).toBe('NON_MONOTONIC_VERSION');
  });

  it('TS-VER-04 / OPEN-02: un salto de 2 a 7 se acepta (monotónica, no consecutiva)', () => {
    const payload = { ...fixture(3), response_version: 7 };

    expect(() =>
      validator.validate(
        payload,
        context(
          {
            currentVersion: 2,
            currentMilestone: BusinessMilestone.ENGINEER_ASSIGNED,
            existingResponseId: ROUTE_RESPONSE_ID,
          },
          payload,
        ),
      ),
    ).not.toThrow();
  });

  // ----------------------------------------------------- máquina de hitos

  it('TS-MIL-07 / INV-16: retroceso de ROUTE_CAPACITY_REGISTERED a ENGINEER_ASSIGNED → MILESTONE_REGRESSION', () => {
    const payload = { ...fixture(2), response_version: 4 };

    expect(
      codeOf(() =>
        validator.validate(
          payload,
          context(
            {
              currentVersion: 3,
              currentMilestone: BusinessMilestone.ROUTE_CAPACITY_REGISTERED,
              existingResponseId: ROUTE_RESPONSE_ID,
            },
            payload,
          ),
        ),
      ),
    ).toBe('MILESTONE_REGRESSION');
  });

  it('TS-MIL-08: publicar otro hito tras INTERACTION_COMPLETED → INTERACTION_ALREADY_COMPLETED', () => {
    const payload = { ...fixture(4), response_version: 6 };

    expect(
      codeOf(() =>
        validator.validate(
          payload,
          context(
            {
              currentVersion: 5,
              currentMilestone: BusinessMilestone.INTERACTION_COMPLETED,
              existingResponseId: ROUTE_RESPONSE_ID,
            },
            payload,
          ),
        ),
      ),
    ).toBe('INTERACTION_ALREADY_COMPLETED');
  });

  it('TS-MIL-01: INTERACTION_RECEIVED con response_status distinto de RECEIVED → 422', () => {
    const payload = {
      ...fixture(1),
      response_status: 'IN_PROGRESS',
    } as unknown as PublishResponseDto;

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('INVALID_RESPONSE_STATUS');
  });

  it('TS-MIL-02: ENGINEER_ASSIGNED sin assignment → 422', () => {
    const payload = { ...fixture(2), assignment: null };

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('MILESTONE_REQUIREMENTS_NOT_MET');
  });

  it('TS-MIL-03: ENGINEER_ASSIGNED sin planner_interaction_url → 422', () => {
    const payload = { ...fixture(2), operational_links: {} };

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('MILESTONE_REQUIREMENTS_NOT_MET');
  });

  it('TS-MIL-04: ROUTE_CAPACITY_REGISTERED sin eta_date → 422', () => {
    const payload = { ...fixture(3), eta_date: null };

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('MILESTONE_REQUIREMENTS_NOT_MET');
  });

  it('TS-MIL-05: ROUTE_CAPACITY_REGISTERED sin route_capacity_register_url → 422', () => {
    const base = fixture(3);
    const payload = {
      ...base,
      operational_links: {
        planner_interaction_url:
          base.operational_links?.planner_interaction_url,
      },
    } as PublishResponseDto;

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('MILESTONE_REQUIREMENTS_NOT_MET');
  });

  it('§7.1: `assignment` no puede volver a null en un hito posterior', () => {
    const payload = { ...fixture(5), assignment: null };

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('MILESTONE_REQUIREMENTS_NOT_MET');
  });

  it('TS-MIL-06: INTERACTION_COMPLETED con un servicio sin deliverables → 422', () => {
    const base = fixture(5);
    const payload = {
      ...base,
      service_results: [
        { ...base.service_results[0], deliverables: [] },
        base.service_results[1],
      ],
    };

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('MILESTONE_REQUIREMENTS_NOT_MET');
  });

  it('TS-MIL-09: `eta_date` es global y único — no existe un ETA por servicio', () => {
    const payload = fixture(3);

    expect(payload).toHaveProperty('eta_date');
    for (const result of payload.service_results) {
      expect(result).not.toHaveProperty('eta_date');
    }
  });

  // ------------------------------------------------------ service_results

  it('TS-SVC-05 / INV-01: técnico dependiente de financiero → INVERTED_SERVICE_DEPENDENCY', () => {
    const base = fixture(1);
    const payload = {
      ...base,
      service_results: [
        { ...base.service_results[0], dependency: 'FINANCIAL_DESIGN' },
        base.service_results[1],
      ],
    } as unknown as PublishResponseDto;

    const error = (() => {
      try {
        validator.validate(payload, context({}, payload));
      } catch (e) {
        return e as MepProblemException;
      }
      throw new Error('Se esperaba 422');
    })();

    expect(error.code).toBe('INVERTED_SERVICE_DEPENDENCY');
    expect(error.getStatus()).toBe(422);
    expect(error.errors).toContainEqual({
      pointer: '/service_results/0/dependency',
      code: 'INVERTED_SERVICE_DEPENDENCY',
    });
  });

  it('TS-SVC-06: TECHNICAL_DESIGN duplicado en service_results → DUPLICATE_SERVICE', () => {
    const base = fixture(1);
    const payload = {
      ...base,
      service_results: [base.service_results[0], base.service_results[0]],
    };

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('DUPLICATE_SERVICE');
  });

  it('TS-SVC-07: outcome no nulo con status RECEIVED → INVALID_SERVICE_OUTCOME', () => {
    const base = fixture(1);
    const payload = {
      ...base,
      service_results: [
        { ...base.service_results[0], outcome: 'VIABLE' },
        base.service_results[1],
      ],
    } as unknown as PublishResponseDto;

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('INVALID_SERVICE_OUTCOME');
  });

  it('§6.5: un servicio COMPLETED debe declarar su outcome', () => {
    const base = fixture(5);
    const payload = {
      ...base,
      service_results: [
        { ...base.service_results[0], outcome: null },
        base.service_results[1],
      ],
    };

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('INVALID_SERVICE_OUTCOME');
  });

  it('TS-SVC-08: outcome NOT_VIABLE sin reason_code → MISSING_REASON_CODE', () => {
    const base = fixture(5);
    const payload = {
      ...base,
      service_results: [
        {
          ...base.service_results[0],
          outcome: 'NOT_VIABLE',
          reason_code: null,
        },
        base.service_results[1],
      ],
    } as unknown as PublishResponseDto;

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('MISSING_REASON_CODE');
  });

  it('§6.5: un servicio CANCELLED exige reason_code', () => {
    const base = fixture(5);
    const payload = {
      ...base,
      service_results: [
        {
          ...base.service_results[0],
          status: 'CANCELLED',
          outcome: null,
          reason_code: null,
        },
        base.service_results[1],
      ],
    } as unknown as PublishResponseDto;

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('MISSING_REASON_CODE');
  });

  it('TS-SVC-09 / INV-23: deliverable apuntando a SharePoint List → DELIVERABLE_NOT_A_DOCUMENT', () => {
    const base = fixture(5);
    const payload = {
      ...base,
      service_results: [
        {
          ...base.service_results[0],
          deliverables: [
            {
              url: 'https://verytel.sharepoint.com/sites/preventa/Lists/Commitments/DispForm.aspx?ID=20004',
              label: 'Registro de ruta',
              published_at: '2026-08-27T16:00:00Z',
            },
          ],
        },
        base.service_results[1],
      ],
    };

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('DELIVERABLE_NOT_A_DOCUMENT');
  });

  // --------------------------------------------------------- clasificación

  it('TS-CLS-01 / INV-20: delivered_interaction_type en V1..V4 → PREMATURE_CLASSIFICATION', () => {
    for (const v of [1, 2, 3, 4] as const) {
      const payload = {
        ...fixture(v),
        delivered_interaction_type: 'DISENO_TECNICO',
      };

      expect(
        codeOf(() => validator.validate(payload, context({}, payload))),
      ).toBe('PREMATURE_CLASSIFICATION');
    }
  });

  it('TS-CLS-02 / INV-18: TIPO-POR-ESPECIFICAR al cierre → PROVISIONAL_CLASSIFICATION', () => {
    const payload = {
      ...fixture(5),
      delivered_interaction_type: 'TIPO-POR-ESPECIFICAR',
    };

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('PROVISIONAL_CLASSIFICATION');
  });

  it('TS-CLS-03: INTERACTION_COMPLETED con delivered_interaction_type null → MISSING_CLASSIFICATION', () => {
    const payload = { ...fixture(5), delivered_interaction_type: null };

    expect(
      codeOf(() => validator.validate(payload, context({}, payload))),
    ).toBe('MISSING_CLASSIFICATION');
  });

  // ---------------------------------------------------------- frontera LEAN

  it('TS-LEAN-01 / INV-24: `evidence_url` en el payload → UNKNOWN_PROPERTY', () => {
    const payload = fixture(1);
    const rawBody = { ...payload, evidence_url: 'https://algo' };

    expect(
      codeOf(() => validator.validate(payload, context({ rawBody }))),
    ).toBe('UNKNOWN_PROPERTY');
  });

  it('TS-VER-10 / INV-27: `delivery_attempt` no puede acompañar a response_version', () => {
    const payload = fixture(3);
    const rawBody = { ...payload, delivery_attempt: 3 };

    expect(
      codeOf(() => validator.validate(payload, context({ rawBody }))),
    ).toBe('UNKNOWN_PROPERTY');
  });

  // -------------------------------------------------------- forma del error

  it('INV-02 / §5.4: el error 422 no filtra source_content ni la API key', () => {
    const payload = { ...fixture(5), delivered_interaction_type: null };

    let error!: MepProblemException;
    try {
      validator.validate(payload, context({}, payload));
    } catch (e) {
      error = e as MepProblemException;
    }

    const serialized = JSON.stringify(error.getResponse());
    expect(serialized).not.toContain('source_content');
    expect(serialized.toLowerCase()).not.toContain('x-api-key');
  });
});
