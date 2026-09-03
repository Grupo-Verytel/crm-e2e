import type {
  DatosBaseProyecto,
  EmpresaEjecutora,
  MiembroEjecutor,
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

/** Razón social por defecto de cada botón. En UT el nombre lo escribe el usuario. */
const NOMBRE_POR_EMPRESA: Record<EmpresaEjecutora, string> = {
  Frisson: 'Frisson S.A.S.',
  Verytel: 'Verytel S.A.',
  UT: '',
};

/** Sólo las razones sociales propias son fijas; UT y socios externos se escriben. */
function nombreEditable(miembro: MiembroEjecutor): boolean {
  return miembro.empresa === 'UT' || miembro.empresa === null;
}

function nuevoId(): string {
  return `me-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Reparte 100% en partes iguales y le deja el sobrante al primero, para que la
 * suma cierre exacta sin decimales (33/33/34, no 33.33 x3).
 */
function repartirEquitativo(miembros: MiembroEjecutor[]): MiembroEjecutor[] {
  if (miembros.length === 0) return miembros;
  const base = Math.floor(100 / miembros.length);
  const sobrante = 100 - base * miembros.length;
  return miembros.map((m, i) => ({
    ...m,
    participacionPct: i === 0 ? base + sobrante : base,
  }));
}

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

  function nuevoMiembro(e: EmpresaEjecutora): MiembroEjecutor {
    return {
      id: nuevoId(),
      nombre: NOMBRE_POR_EMPRESA[e],
      participacionPct: 0,
      empresa: e,
    };
  }

  /** Los botones quedan encendidos según las filas que existen, no al revés. */
  function empresasDe(miembros: MiembroEjecutor[]): EmpresaEjecutora[] {
    return EMPRESAS.filter((e) => miembros.some((m) => m.empresa === e));
  }

  function aplicarMiembros(miembros: MiembroEjecutor[]) {
    patch({
      unionesTemporales: repartirEquitativo(miembros),
      empresasEjecutoras: empresasDe(miembros),
    });
  }

  /**
   * El botón y su fila son la misma cosa. Frisson y Verytel son razones sociales
   * propias: aparecen una vez y el botón alterna. `UT` no alterna — cada clic
   * suma un miembro más de la unión temporal, con la razón social en blanco para
   * que el usuario la escriba.
   */
  function toggleEmpresa(e: EmpresaEjecutora) {
    if (e === 'UT') {
      aplicarMiembros([...datos.unionesTemporales, nuevoMiembro(e)]);
      return;
    }

    const activa = datos.unionesTemporales.some((m) => m.empresa === e);
    aplicarMiembros(
      activa
        ? datos.unionesTemporales.filter((m) => m.empresa !== e)
        : [...datos.unionesTemporales, nuevoMiembro(e)],
    );
  }

  function quitarMiembro(id: string) {
    aplicarMiembros(datos.unionesTemporales.filter((m) => m.id !== id));
  }

  function actualizarMiembro(id: string, cambio: Partial<MiembroEjecutor>) {
    patch({
      unionesTemporales: datos.unionesTemporales.map((m) =>
        m.id === id ? { ...m, ...cambio } : m,
      ),
    });
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
              title={
                e === 'UT'
                  ? 'Agrega un miembro de la unión temporal'
                  : `Ejecuta ${NOMBRE_POR_EMPRESA[e]}`
              }
              onClick={() => toggleEmpresa(e)}
            >
              {e === 'UT' ? 'UT +' : e}
            </button>
          ))}
        </div>
        {datos.unionesTemporales.map((miembro) => (
          <div
            key={miembro.id}
            className="mb-2 grid grid-cols-[1fr_100px_auto] items-center gap-2"
          >
            <input
              className={inputClass}
              value={miembro.nombre}
              readOnly={!nombreEditable(miembro)}
              placeholder={
                miembro.empresa === 'UT'
                  ? 'Nombre de la unión temporal'
                  : 'Razón social del socio'
              }
              aria-label="Razón social"
              onChange={(e) =>
                actualizarMiembro(miembro.id, { nombre: e.target.value })
              }
            />
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={miembro.participacionPct}
              aria-label={`Participación de ${miembro.nombre || 'la empresa'}`}
              onChange={(e) =>
                actualizarMiembro(miembro.id, {
                  participacionPct: Number(e.target.value),
                })
              }
            />
            <button
              type="button"
              className="px-2 text-sm text-muted hover:text-danger"
              aria-label={`Quitar ${miembro.nombre || 'empresa'}`}
              onClick={() => quitarMiembro(miembro.id)}
            >
              Quitar
            </button>
          </div>
        ))}

        {datos.unionesTemporales.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            Selecciona la empresa ejecutora, o usa <strong>UT +</strong> para
            armar una unión temporal miembro por miembro.
          </p>
        ) : !pctOk ? (
          <p className="mt-2 text-xs font-bold text-accent">
            La suma de participación debe ser 100% (actual: {pctSum}%)
          </p>
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
