import { formatDateTime } from '../../../lib/format';
import type { TransicionEstado } from '../api/projects-api';
import { cardClass } from './ui';

/**
 * Línea de tiempo de estados del proyecto, tal como los registra el PMO.
 * Los nombres de estado van en español porque son el dato real (`STA_CNAME`),
 * no una clave del contrato.
 */
export function HistorialEstados({
  transiciones,
}: {
  transiciones: TransicionEstado[];
}) {
  return (
    <section className={cardClass}>
      <h2 className="mb-3 text-sm font-bold text-ink">Línea de tiempo</h2>

      {transiciones.length === 0 ? (
        <p className="text-sm text-muted">
          El PMO todavía no registra cambios de estado para este proyecto.
        </p>
      ) : (
        <ol className="space-y-3 border-l-2 border-border pl-4">
          {transiciones.map((transicion) => (
            <li
              key={`${transicion.occurredAt}-${transicion.newState}`}
              className="text-sm"
            >
              <p className="font-bold text-ink">
                {transicion.previousState
                  ? `${transicion.previousState} → ${transicion.newState}`
                  : transicion.newState}
              </p>
              <p className="text-xs text-muted">
                {formatDateTime(transicion.occurredAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
