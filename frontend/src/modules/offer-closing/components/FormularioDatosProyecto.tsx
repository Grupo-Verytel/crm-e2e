import { DatePickerField } from '../../../components/DatePickerField';
import type {
  DatosBaseProyecto,
  EmpresaEjecutora,
  TipoVenta,
} from '../../shared/project/types';
import { TIPO_VENTA_LABEL } from '../../shared/project/types';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  selectClass,
} from './ui';

const EMPRESAS: EmpresaEjecutora[] = ['Frisson', 'Verytel', 'UT'];

const EMPRESA_NOMBRE: Record<EmpresaEjecutora, string> = {
  Frisson: 'Frisson',
  Verytel: 'Verytel S.A.',
  UT: 'Unión temporal',
};

function nombreToEmpresa(nombre: string): EmpresaEjecutora | null {
  const entry = (
    Object.entries(EMPRESA_NOMBRE) as [EmpresaEjecutora, string][]
  ).find(([, label]) => label === nombre);
  return entry?.[0] ?? null;
}

function syncParticipaciones(
  selected: EmpresaEjecutora[],
  current: { nombre: string; participacionPct: number }[],
): { nombre: string; participacionPct: number }[] {
  if (selected.length === 0) return [];

  const byEmpresa = new Map<EmpresaEjecutora, number>();
  for (const row of current) {
    const emp = nombreToEmpresa(row.nombre);
    if (emp) byEmpresa.set(emp, row.participacionPct);
  }

  if (selected.length === 1) {
    const only = selected[0];
    return [
      {
        nombre: EMPRESA_NOMBRE[only],
        participacionPct: byEmpresa.get(only) ?? 100,
      },
    ];
  }

  const equal = Math.floor(100 / selected.length);
  let remainder = 100 - equal * selected.length;

  return selected.map((emp, index) => {
    const prev = byEmpresa.get(emp);
    let pct = prev ?? equal;
    if (prev === undefined && remainder > 0 && index === 0) {
      pct = equal + remainder;
      remainder = 0;
    }
    return { nombre: EMPRESA_NOMBRE[emp], participacionPct: pct };
  });
}

type Props = {
  datos: DatosBaseProyecto;
  modo: 'crear' | 'ampliar';
  onChange: (datos: DatosBaseProyecto) => void;
};

/** C6 — HU-F04 form, reused by HU-F06 "Ampliar proyecto". */
export function FormularioDatosProyecto({
  datos,
  modo,
  onChange,
}: Props) {
  const pctSum = datos.unionesTemporales.reduce(
    (s, u) => s + u.participacionPct,
    0,
  );
  const pctOk =
    datos.empresasEjecutoras.length === 0 || pctSum === 100;

  function patch(partial: Partial<DatosBaseProyecto>) {
    onChange({ ...datos, ...partial });
  }

  function toggleEmpresa(e: EmpresaEjecutora) {
    const set = new Set(datos.empresasEjecutoras);
    if (set.has(e)) set.delete(e);
    else set.add(e);
    const selected = EMPRESAS.filter((x) => set.has(x));
    patch({
      empresasEjecutoras: selected,
      unionesTemporales: syncParticipaciones(
        selected,
        datos.unionesTemporales,
      ),
    });
  }

  function setParticipacion(index: number, value: number) {
    const next = [...datos.unionesTemporales];
    const row = next[index];
    if (!row) return;
    next[index] = {
      ...row,
      participacionPct: Number.isFinite(value) ? value : 0,
    };
    patch({ unionesTemporales: next });
  }

  const empresaSection = (
    <section className={cardClass}>
      <h3 className="mb-3 text-sm font-bold text-ink">Empresa ejecutora / UT</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {EMPRESAS.map((e) => (
          <button
            key={e}
            type="button"
            className={
              datos.empresasEjecutoras.includes(e)
                ? primaryButtonClass
                : ghostButtonClass
            }
            onClick={() => toggleEmpresa(e)}
          >
            {e}
          </button>
        ))}
      </div>

      {datos.empresasEjecutoras.length === 0 ? (
        <p className="text-xs text-muted">
          Selecciona una o más empresas para asignar el % de ingresos.
        </p>
      ) : (
        <>
          <div className="mb-1 grid grid-cols-[1fr_7rem] gap-2 text-xs font-bold text-muted">
            <span>Empresa</span>
            <span className="text-right">% ingresos</span>
          </div>
          {datos.unionesTemporales.map((ut, i) => (
            <div
              key={ut.nombre}
              className="mb-2 grid grid-cols-[1fr_7rem] items-center gap-2"
            >
              <input className={inputClass} value={ut.nombre} readOnly />
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={`${inputClass} pr-7 text-right`}
                  value={ut.participacionPct}
                  aria-label={`% ingresos ${ut.nombre}`}
                  onChange={(e) =>
                    setParticipacion(i, Number(e.target.value))
                  }
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">
                  %
                </span>
              </div>
            </div>
          ))}
          {!pctOk ? (
            <p className="text-xs font-bold text-accent">
              La suma de % de ingresos debe ser 100% (actual: {pctSum}%)
            </p>
          ) : (
            <p className="text-xs text-muted">
              Suma de participación: {pctSum}%
            </p>
          )}
        </>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-ink">
          Datos precargados (solo consulta)
        </h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Oportunidad</dt>
            <dd className="font-bold text-accent">{datos.consecutivo}</dd>
          </div>
          <div>
            <dt className="text-muted">Cliente</dt>
            <dd>{datos.cliente}</dd>
          </div>
        </dl>
      </section>

      <section className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-ink">
          {modo === 'ampliar'
            ? 'Ampliar proyecto'
            : 'Datos obligatorios del proyecto'}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="nombre-proyecto">
              Nombre del proyecto *
            </label>
            <input
              id="nombre-proyecto"
              className={inputClass}
              value={datos.nombreProyecto}
              onChange={(e) => patch({ nombreProyecto: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="fecha-inicio">
              Fecha inicio *
            </label>
            <DatePickerField
              id="fecha-inicio"
              value={datos.fechaInicio}
              onChange={(next) => patch({ fechaInicio: next })}
              aria-label="Fecha inicio"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="fecha-fin">
              Fecha fin *
            </label>
            <DatePickerField
              id="fecha-fin"
              value={datos.fechaFin}
              onChange={(next) => patch({ fechaFin: next })}
              aria-label="Fecha fin"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="valor">
              Valor a facturar (COP) *
            </label>
            <input
              id="valor"
              type="number"
              min={0}
              className={inputClass}
              value={datos.valorFacturar || ''}
              onChange={(e) =>
                patch({ valorFacturar: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="costo">
              Costo estimado (COP) *
            </label>
            <input
              id="costo"
              type="number"
              min={0}
              className={inputClass}
              value={datos.costoEstimado || ''}
              onChange={(e) =>
                patch({ costoEstimado: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="tipo-venta">
              Tipo de venta
            </label>
            <select
              id="tipo-venta"
              className={selectClass}
              value={datos.tipoVenta}
              onChange={(e) =>
                patch({ tipoVenta: e.target.value as TipoVenta })
              }
            >
              {(Object.keys(TIPO_VENTA_LABEL) as TipoVenta[]).map((k) => (
                <option key={k} value={k}>
                  {TIPO_VENTA_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={labelClass}>Clasificación</span>
            <div className="mt-2 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!datos.recurrente}
                  onChange={() => patch({ recurrente: false })}
                />
                No recurrente
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={datos.recurrente}
                  onChange={() => patch({ recurrente: true })}
                />
                Recurrente
              </label>
            </div>
          </div>
        </div>
      </section>

      {empresaSection}
    </div>
  );
}
