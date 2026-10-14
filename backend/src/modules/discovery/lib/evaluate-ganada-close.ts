import { InfluenciaEstado, InfluenciaTipo } from '../models/enums/ouv.enums';

/** Types that count toward closing an OUV as Ganada. All five count. */
export const GANADA_INFLUENCE_TYPES = [
  InfluenciaTipo.Economica,
  InfluenciaTipo.Tecnica,
  InfluenciaTipo.Fabrica,
  InfluenciaTipo.Usuario,
  InfluenciaTipo.Coach,
] as const;

export const GANADA_GREEN_REQUIRED = 2 as const;

const GANADA_TYPES = new Set<string>(GANADA_INFLUENCE_TYPES);

const GANADA_TYPE_LABEL: Record<string, string> = {
  [InfluenciaTipo.Economica]: 'Económica',
  [InfluenciaTipo.Tecnica]: 'Técnica',
  [InfluenciaTipo.Fabrica]: 'Fábrica',
  [InfluenciaTipo.Usuario]: 'Usuario',
  [InfluenciaTipo.Coach]: 'Coach',
};

export type GanadaInfluenceInput = {
  tipo: string;
  estado: string;
};

export type GanadaCloseInput = {
  presupuestoConfirmado: boolean;
  presupuestoMonto: string | number | null;
  influences: GanadaInfluenceInput[];
};

export type GanadaCloseResult = {
  passed: boolean;
  presupuestoOk: boolean;
  greenTypes: string[];
  required: typeof GANADA_GREEN_REQUIRED;
  detalle: string | null;
};

function presupuestoMayorACero(
  confirmado: boolean,
  monto: string | number | null,
): boolean {
  if (confirmado !== true || monto === null || monto === '') return false;
  const value = typeof monto === 'number' ? monto : Number(monto);
  return Number.isFinite(value) && value > 0;
}

/**
 * Ganada is allowed from any funnel zone when the confirmed budget is
 * greater than 0 and at least two distinct types among Económica, Técnica,
 * Fábrica, Usuario and Coach have a contact in Verde.
 * A Rojo on the same type does not cancel a Verde. Two Verdes of one type
 * still count as one type.
 */
export function evaluateGanadaClose(input: GanadaCloseInput): GanadaCloseResult {
  const presupuestoOk = presupuestoMayorACero(
    input.presupuestoConfirmado,
    input.presupuestoMonto,
  );

  const green = new Set<string>();
  for (const row of input.influences) {
    if (row.estado === InfluenciaEstado.Verde && GANADA_TYPES.has(row.tipo)) {
      green.add(row.tipo);
    }
  }
  const greenTypes = GANADA_INFLUENCE_TYPES.filter((tipo) => green.has(tipo));
  const influencesOk = greenTypes.length >= GANADA_GREEN_REQUIRED;

  const issues: string[] = [];
  if (!presupuestoOk) {
    issues.push('El presupuesto debe estar confirmado y ser mayor a 0.');
  }
  if (!influencesOk) {
    const names = greenTypes.map((tipo) => GANADA_TYPE_LABEL[tipo] ?? tipo);
    const actual =
      names.length > 0
        ? `${greenTypes.length} (${names.join(', ')})`
        : String(greenTypes.length);
    issues.push(
      `Se requieren al menos ${GANADA_GREEN_REQUIRED} tipos de influencia en Verde (Económica, Técnica, Fábrica, Usuario, Coach). Actualmente: ${actual}.`,
    );
  }

  return {
    passed: presupuestoOk && influencesOk,
    presupuestoOk,
    greenTypes,
    required: GANADA_GREEN_REQUIRED,
    detalle: issues.length > 0 ? issues.join(' ') : null,
  };
}
