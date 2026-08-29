import type { DatosBaseProyecto, EmpresaEjecutora, TipoVenta } from '../../shared/project/types';
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

const DIRECTORES = [
  { id: 'dp-001', nombre: 'Diego Herrera' },
  { id: 'dp-002', nombre: 'María Soto' },
  { id: 'dp-003', nombre: 'Andrés Pérez' },
];

type Props = {
  datos: DatosBaseProyecto;
  modo: 'crear' | 'ampliar';
  onChange: (datos: DatosBaseProyecto) => void;
  onNotifyDirector?: (nombre: string) => void;
};

/** C6 — HU-F04 form, reused by HU-F06 "Ampliar proyecto". */
export function FormularioDatosProyecto({
  datos,
  modo,
  onChange,
  onNotifyDirector,
}: Props) {
  const pctSum = datos.unionesTemporales.reduce((s, u) => s + u.participacionPct, 0);
  const pctOk = pctSum === 100;

  function patch(partial: Partial<DatosBaseProyecto>) {
    onChange({ ...datos, ...partial });
  }

  function toggleEmpresa(e: EmpresaEjecutora) {
    const set = new Set(datos.empresasEjecutoras);
    if (set.has(e)) set.delete(e);
    else set.add(e);
    patch({ empresasEjecutoras: [...set] });
  }

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-ink">Datos precargados (solo consulta)</h3>
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
          {modo === 'ampliar' ? 'Ampliar proyecto' : 'Datos obligatorios del proyecto'}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="nombre-proyecto">Nombre del proyecto *</label>
            <input
              id="nombre-proyecto"
              className={inputClass}
              value={datos.nombreProyecto}
              onChange={(e) => patch({ nombreProyecto: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="fecha-inicio">Fecha inicio *</label>
            <input
              id="fecha-inicio"
              type="date"
              className={inputClass}
              value={datos.fechaInicio}
              onChange={(e) => patch({ fechaInicio: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="fecha-fin">Fecha fin *</label>
            <input
              id="fecha-fin"
              type="date"
              className={inputClass}
              value={datos.fechaFin}
              onChange={(e) => patch({ fechaFin: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="valor">Valor a facturar (COP) *</label>
            <input
              id="valor"
              type="number"
              min={0}
              className={inputClass}
              value={datos.valorFacturar || ''}
              onChange={(e) => patch({ valorFacturar: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="costo">Costo estimado (COP) *</label>
            <input
              id="costo"
              type="number"
              min={0}
              className={inputClass}
              value={datos.costoEstimado || ''}
              onChange={(e) => patch({ costoEstimado: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="tipo-venta">Tipo de venta</label>
            <select
              id="tipo-venta"
              className={selectClass}
              value={datos.tipoVenta}
              onChange={(e) => patch({ tipoVenta: e.target.value as TipoVenta })}
            >
              {(Object.keys(TIPO_VENTA_LABEL) as TipoVenta[]).map((k) => (
                <option key={k} value={k}>{TIPO_VENTA_LABEL[k]}</option>
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
        {datos.unionesTemporales.map((ut, i) => (
          <div key={ut.nombre} className="mb-2 grid grid-cols-[1fr_100px] gap-2">
            <input className={inputClass} value={ut.nombre} readOnly />
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={ut.participacionPct}
              onChange={(e) => {
                const next = [...datos.unionesTemporales];
                next[i] = { ...ut, participacionPct: Number(e.target.value) };
                patch({ unionesTemporales: next });
              }}
            />
          </div>
        ))}
        {!pctOk ? (
          <p className="text-xs font-bold text-accent">La suma de participación debe ser 100% (actual: {pctSum}%)</p>
        ) : null}
      </section>

      <section className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-ink">Director de proyecto</h3>
        <select
          className={selectClass}
          value={datos.directorProyectoId ?? ''}
          onChange={(e) => {
            const d = DIRECTORES.find((x) => x.id === e.target.value);
            patch({
              directorProyectoId: d?.id ?? null,
              directorProyectoNombre: d?.nombre ?? null,
            });
            if (d) onNotifyDirector?.(d.nombre);
          }}
        >
          <option value="">Seleccionar…</option>
          {DIRECTORES.map((d) => (
            <option key={d.id} value={d.id}>{d.nombre}</option>
          ))}
        </select>
      </section>

      <section className={`${cardClass} opacity-60`}>
        <h3 className="text-sm font-bold text-muted">Indicadores financieros</h3>
        <p className="mt-1 text-xs text-muted">Pendiente de definición con Preventa / Finanzas / PMO</p>
      </section>
    </div>
  );
}

export { DIRECTORES };
