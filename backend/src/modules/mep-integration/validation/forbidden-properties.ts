import { ProblemErrorItem } from '../constants/error-catalog';

/**
 * Frontera LEAN — §7.4 (INV-24, INV-25, INV-27), tests TS-LEAN-01/02.
 *
 * Validación mecánica: además de `additionalProperties: false` (que produce
 * UNKNOWN_PROPERTY para cualquier campo no declarado), existe una lista negra
 * explícita de nombres que jamás cruzan el contrato. Se evalúa en profundidad
 * sobre todo el payload, en cualquier nivel de anidamiento.
 */
export const FORBIDDEN_PROPERTY_NAMES: readonly string[] = [
  'interaction_type',
  'evidence_url',
  'process_evidence',
  'excel_row_id',
  'event_id',
  'snapshot_id',
  'cut_id',
  'delivery_attempt',
  'archetype_lane',
];

const FORBIDDEN_SET = new Set(FORBIDDEN_PROPERTY_NAMES);

/**
 * Recorre el payload y devuelve un puntero JSON por cada propiedad prohibida.
 * Array vacío = payload limpio.
 */
export function findForbiddenProperties(
  payload: unknown,
  pointer = '',
): ProblemErrorItem[] {
  const findings: ProblemErrorItem[] = [];
  walk(payload, pointer, findings);
  return findings;
}

function walk(
  node: unknown,
  pointer: string,
  findings: ProblemErrorItem[],
): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, `${pointer}/${index}`, findings));
    return;
  }

  if (node === null || typeof node !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const childPointer = `${pointer}/${escapePointerToken(key)}`;
    if (FORBIDDEN_SET.has(key.toLowerCase())) {
      findings.push({
        pointer: childPointer,
        // INV-24/INV-25 se materializan como UNKNOWN_PROPERTY: el CRM no
        // reconoce el nombre, no explica el concepto interno de MEP.
        code: 'UNKNOWN_PROPERTY',
      });
      continue;
    }
    walk(value, childPointer, findings);
  }
}

/** Escapado de tokens de JSON Pointer (RFC 6901). */
function escapePointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}
