import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Handshake } from 'lucide-react';
import { DatePickerField } from '../../../components/DatePickerField';
import { sumaParticipacionDecimas } from '../../shared/project/mock-store';
import type {
  DatosBaseProyecto,
  EmpresaEjecutora,
  MiembroEjecutor,
  TipoVenta,
} from '../../shared/project/types';
import { TIPO_VENTA_LABEL } from '../../shared/project/types';
import {
  listEmpresasExternas,
  type EmpresaExterna,
  type EmpresaExternaKind,
} from '../api/executing-companies-api';
import { CrearEmpresaExternaModal } from './CrearEmpresaExternaModal';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  selectClass,
} from './ui';

const EMPRESAS: EmpresaEjecutora[] = ['Frisson', 'Verytel', 'UT', 'Aliado'];

const EMPRESA_NOMBRE: Record<EmpresaEjecutora, string> = {
  Frisson: 'Frisson',
  Verytel: 'Verytel S.A.',
  UT: 'Unión temporal',
  Aliado: 'Aliado',
};

/** Fijos por ahora (DR 2026-10 UT y aliados): no hay catálogo de empresas propias. */
const EMPRESA_NIT: Record<'Frisson' | 'Verytel', string> = {
  Frisson: '900784911-1',
  Verytel: '830050633-1',
};

const EXTERNA_LABEL: Record<EmpresaExternaKind, string> = {
  UT: 'Unión temporal',
  Aliado: 'Aliado',
};

function esExterna(e: EmpresaEjecutora | null): e is EmpresaExternaKind {
  return e === 'UT' || e === 'Aliado';
}

function nuevoId(): string {
  return `me-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Redondea a un decimal: el % de ingresos no admite más. */
function unDecimal(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;
}

/**
 * Enciende o apaga una empresa: una fila por chip y reparte 100% si hay una
 * sola o partes iguales a un decimal si hay varias (33.4/33.3/33.3).
 *
 * Frisson y Verytel llevan nombre fijo; UT y Aliado conservan la empresa del
 * catálogo que ya tuvieran elegida.
 */
function syncParticipaciones(
  selected: EmpresaEjecutora[],
  current: MiembroEjecutor[],
): MiembroEjecutor[] {
  if (selected.length === 0) return [];

  const byEmpresa = new Map<EmpresaEjecutora, MiembroEjecutor>();
  for (const row of current) {
    if (row.empresa) byEmpresa.set(row.empresa, row);
  }

  const fila = (emp: EmpresaEjecutora, pct: number): MiembroEjecutor => {
    const prev = byEmpresa.get(emp);
    return {
      id: prev?.id ?? nuevoId(),
      nombre: esExterna(emp) ? (prev?.nombre ?? '') : EMPRESA_NOMBRE[emp],
      participacionPct: pct,
      empresa: emp,
      jointVentureId: emp === 'UT' ? (prev?.jointVentureId ?? null) : null,
      partnerId: emp === 'Aliado' ? (prev?.partnerId ?? null) : null,
      nit: esExterna(emp) ? (prev?.nit ?? null) : null,
    };
  };

  // Al cambiar el número de empresas se reparte de nuevo en partes iguales:
  // conservar el % anterior dejaba sumas de 150% al agregar una segunda.
  const equalDecimas = Math.floor(1000 / selected.length);
  const remainder = 1000 - equalDecimas * selected.length;

  return selected.map((emp, i) =>
    fila(emp, (equalDecimas + (i === 0 ? remainder : 0)) / 10),
  );
}

/**
 * Fija el % de una fila (0–100) y reparte el resto entre las demás en
 * proporción a lo que ya tenían, para que la suma quede siempre en 100%.
 * Con dos empresas la otra toma el complemento (60 → 40).
 */
function ajustarParticipacion(
  filas: MiembroEjecutor[],
  index: number,
  value: number,
): MiembroEjecutor[] {
  const fijadas = Math.min(1000, Math.max(0, Math.round(value * 10)));
  const otras = filas.map((_, i) => i).filter((i) => i !== index);
  if (otras.length === 0) {
    return filas.map((row) => ({ ...row, participacionPct: 100 }));
  }

  const resto = 1000 - fijadas;
  const pesos = otras.map((i) => Math.round(filas[i].participacionPct * 10));
  const totalPesos = pesos.reduce((s, p) => s + p, 0);
  // Reparto en décimas por mayor residuo, para no perder ni sobrar décimas.
  const exactas = otras.map((_, k) =>
    totalPesos > 0 ? (resto * pesos[k]) / totalPesos : resto / otras.length,
  );
  const decimas = exactas.map(Math.floor);
  let faltan = resto - decimas.reduce((s, d) => s + d, 0);
  const porResiduo = exactas
    .map((x, k) => ({ k, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r);
  for (const { k } of porResiduo) {
    if (faltan <= 0) break;
    decimas[k] += 1;
    faltan -= 1;
  }

  const next = filas.map((row) => ({ ...row }));
  next[index].participacionPct = fijadas / 10;
  otras.forEach((i, k) => {
    next[i].participacionPct = decimas[k] / 10;
  });
  return next;
}

type CatalogOption = { id: string; nombre: string };

/** Selector de UT o aliado dentro de la fila de la tabla. */
function TableSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: CatalogOption[];
  onChange: (selected: CatalogOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((item) => item.id === value);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="flex h-8 w-full items-center justify-between gap-2 bg-transparent text-left text-sm outline-none"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((next) => !next)}
      >
        <span className={selected ? 'text-ink' : 'text-muted'}>
          {selected?.nombre ?? 'Seleccionar'}
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted" />
      </button>
      {open ? (
        <ul
          className="absolute left-0 right-0 z-40 mt-1 max-h-56 overflow-y-auto rounded border border-border bg-surface shadow-card"
          role="listbox"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className="w-full px-3 py-2 text-left text-sm text-muted hover:bg-bg"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Seleccionar
            </button>
          </li>
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">
              Sin registros en el catálogo
            </li>
          ) : null}
          {options.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === value}
                className={
                  item.id === value
                    ? 'w-full bg-bg px-3 py-2 text-left text-sm font-bold text-ink hover:bg-bg'
                    : 'w-full px-3 py-2 text-left text-sm text-ink hover:bg-bg'
                }
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                }}
              >
                {item.nombre}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Props = {
  datos: DatosBaseProyecto;
  modo: 'crear' | 'ampliar';
  onChange: (datos: DatosBaseProyecto) => void;
  /** La clasificación viene de la OUV ("Proyecto") y no se edita aquí. */
  recurrenteBloqueado?: boolean;
  /** CASL `create JointVenture` / `create Partner` (solo SoporteComercial). */
  puedeCrearEmpresas?: Record<EmpresaExternaKind, boolean>;
};

/** Botón de ícono suave: tinte del acento al pasar, sin relleno sólido. */
const iconButtonClass =
  'grid h-9 w-9 cursor-pointer place-items-center rounded-xl border border-accent/25 bg-accent/5 text-accent transition-all duration-300 ease-out hover:-translate-y-px hover:border-accent/40 hover:bg-accent/15 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:translate-y-0 active:scale-95';

/** C6 — HU-F04 form, reused by HU-F06 "Ampliar proyecto". */
export function FormularioDatosProyecto({
  datos,
  modo,
  onChange,
  recurrenteBloqueado = false,
  puedeCrearEmpresas = { UT: false, Aliado: false },
}: Props) {
  const [catalogos, setCatalogos] = useState<
    Record<EmpresaExternaKind, EmpresaExterna[]>
  >({ UT: [], Aliado: [] });
  const [catalogoError, setCatalogoError] = useState<string | null>(null);
  const [crearModal, setCrearModal] = useState<EmpresaExternaKind | null>(
    null,
  );

  // Los catálogos son compartidos (backend), así que se piden al montar.
  useEffect(() => {
    let cancelled = false;
    Promise.all([listEmpresasExternas('UT'), listEmpresasExternas('Aliado')])
      .then(([uts, aliados]) => {
        if (!cancelled) setCatalogos({ UT: uts, Aliado: aliados });
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogoError(
            'No se pudo cargar el catálogo de uniones temporales y aliados.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pctSumDecimas = sumaParticipacionDecimas(datos.unionesTemporales);
  const pctOk = datos.empresasEjecutoras.length === 0 || pctSumDecimas === 1000;

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
    if (!datos.unionesTemporales[index]) return;
    patch({
      unionesTemporales: ajustarParticipacion(
        datos.unionesTemporales,
        index,
        unDecimal(value),
      ),
    });
  }

  /**
   * Asigna la UT o el aliado a su fila. Si la empresa todavía no estaba
   * encendida (se acaba de crear desde el botón), la enciende.
   */
  function setEmpresaExterna(
    kind: EmpresaExternaKind,
    selected: EmpresaExterna | null,
  ) {
    const empresas = datos.empresasEjecutoras.includes(kind)
      ? datos.empresasEjecutoras
      : EMPRESAS.filter(
          (x) => x === kind || datos.empresasEjecutoras.includes(x),
        );
    const filas = datos.empresasEjecutoras.includes(kind)
      ? datos.unionesTemporales
      : syncParticipaciones(empresas, datos.unionesTemporales);
    patch({
      empresasEjecutoras: empresas,
      unionesTemporales: filas.map((row) =>
        row.empresa === kind
          ? {
              ...row,
              nombre: selected?.nombre ?? '',
              nit: selected?.nit ?? null,
              jointVentureId: kind === 'UT' ? (selected?.id ?? null) : null,
              partnerId: kind === 'Aliado' ? (selected?.id ?? null) : null,
            }
          : row,
      ),
    });
  }

  function onCreada(kind: EmpresaExternaKind, creada: EmpresaExterna) {
    setCatalogos((prev) => ({
      ...prev,
      [kind]: [...prev[kind], creada].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es'),
      ),
    }));
    setEmpresaExterna(kind, creada);
    setCrearModal(null);
  }

  function nitDeFila(row: MiembroEjecutor): string {
    if (row.empresa === 'Frisson' || row.empresa === 'Verytel') {
      return EMPRESA_NIT[row.empresa];
    }
    if (row.nit) return row.nit;
    const id = row.empresa === 'UT' ? row.jointVentureId : row.partnerId;
    if (!esExterna(row.empresa) || !id) return '';
    return catalogos[row.empresa].find((c) => c.id === id)?.nit ?? '';
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
            <DatePickerField
              id="fecha-inicio"
              value={datos.fechaInicio}
              onChange={(next) => patch({ fechaInicio: next })}
              aria-label="Fecha inicio"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="fecha-fin">Fecha fin *</label>
            <DatePickerField
              id="fecha-fin"
              value={datos.fechaFin}
              onChange={(next) => patch({ fechaFin: next })}
              aria-label="Fecha fin"
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
                  disabled={recurrenteBloqueado}
                  onChange={() => patch({ recurrente: false })}
                />
                No recurrente
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={datos.recurrente}
                  disabled={recurrenteBloqueado}
                  onChange={() => patch({ recurrente: true })}
                />
                Recurrente
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Empresa ejecutora / UT</h3>
          <div className="flex items-center gap-2">
            {puedeCrearEmpresas.UT ? (
              <button
                type="button"
                className={iconButtonClass}
                aria-label="Crear unión temporal"
                title="Crear unión temporal"
                onClick={() => setCrearModal('UT')}
              >
                <Building2 size={20} strokeWidth={2} />
              </button>
            ) : null}
            {puedeCrearEmpresas.Aliado ? (
              <button
                type="button"
                className={iconButtonClass}
                aria-label="Crear aliado"
                title="Crear aliado"
                onClick={() => setCrearModal('Aliado')}
              >
                <Handshake size={20} strokeWidth={2} />
              </button>
            ) : null}
          </div>
        </div>
        {catalogoError ? (
          <p className="mb-3 text-xs text-danger">{catalogoError}</p>
        ) : null}
        <div className="mb-3 flex flex-wrap gap-2">
          {EMPRESAS.map((e) => {
            const activa = datos.empresasEjecutoras.includes(e);
            // Sin UT/aliados en el catálogo no hay qué asignar: quien puede
            // crearlos abre el modal (al crear, la empresa se enciende sola);
            // quien no, ve el chip deshabilitado. Una ya encendida siempre se
            // puede apagar.
            const sinCatalogo =
              esExterna(e) && !activa && catalogos[e].length === 0;
            const abreCrear = sinCatalogo && puedeCrearEmpresas[e];
            const vacio = e === 'UT'
              ? 'No hay uniones temporales creadas'
              : 'No hay aliados creados';
            return (
              <button
                key={e}
                type="button"
                className={`${activa ? primaryButtonClass : ghostButtonClass} cursor-pointer`}
                disabled={sinCatalogo && !abreCrear}
                title={
                  abreCrear
                    ? `${vacio}. Crear ${EXTERNA_LABEL[e].toLowerCase()}`
                    : sinCatalogo
                      ? vacio
                      : undefined
                }
                onClick={() =>
                  abreCrear ? setCrearModal(e) : toggleEmpresa(e)
                }
              >
                {e}
              </button>
            );
          })}
        </div>

        {datos.empresasEjecutoras.length === 0 ? (
          <p className="text-xs text-muted">
            Selecciona una o más empresas para asignar el % de ingresos.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded border border-border bg-bg">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="w-36 border-r border-border px-4 py-2 font-bold">
                      NIT
                    </th>
                    <th className="border-r border-border px-4 py-2 font-bold">
                      Empresa
                    </th>
                    <th className="w-32 px-4 py-2 text-center font-bold">
                      % ingresos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datos.unionesTemporales.map((row, i) => {
                    const kind = row.empresa;
                    const selectedId =
                      kind === 'UT'
                        ? (row.jointVentureId ?? '')
                        : (row.partnerId ?? '');
                    // Una UT o aliado ya asignado y luego inactivado no viene
                    // en el catálogo; se muestra igual con su nombre guardado.
                    const options =
                      esExterna(kind) &&
                      selectedId &&
                      !catalogos[kind].some((c) => c.id === selectedId)
                        ? [
                            { id: selectedId, nombre: row.nombre },
                            ...catalogos[kind],
                          ]
                        : esExterna(kind)
                          ? catalogos[kind]
                          : [];
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="border-r border-border px-4 py-2 text-muted">
                          {nitDeFila(row) || '—'}
                        </td>
                        <td className="border-r border-border px-4 py-2 text-ink">
                          {esExterna(kind) ? (
                            <TableSelect
                              label={EXTERNA_LABEL[kind]}
                              value={selectedId}
                              options={options}
                              onChange={(next) => {
                                if (next && next.id === selectedId) return;
                                setEmpresaExterna(
                                  kind,
                                  next
                                    ? (catalogos[kind].find(
                                        (c) => c.id === next.id,
                                      ) ?? null)
                                    : null,
                                );
                              }}
                            />
                          ) : (
                            row.nombre
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <label className="inline-flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              className="h-8 w-16 bg-transparent text-center text-sm text-ink outline-none"
                              value={row.participacionPct}
                              aria-label={`% ingresos ${row.nombre || kind}`}
                              onChange={(e) =>
                                setParticipacion(i, Number(e.target.value))
                              }
                            />
                            <span className="text-xs text-muted">%</span>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!pctOk ? (
              <p className="mt-2 text-xs font-bold text-accent">
                La suma de % de ingresos debe ser 100% (actual:{' '}
                {pctSumDecimas / 10}%)
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted">
                Suma de participación: {pctSumDecimas / 10}%
              </p>
            )}
          </>
        )}
        {crearModal ? (
          <CrearEmpresaExternaModal
            kind={crearModal}
            title={EXTERNA_LABEL[crearModal]}
            onClose={() => setCrearModal(null)}
            onCreated={(creada) => onCreada(crearModal, creada)}
          />
        ) : null}
      </section>

    </div>
  );
}

