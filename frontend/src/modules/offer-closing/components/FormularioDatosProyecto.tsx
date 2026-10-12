import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Handshake } from 'lucide-react';
import { DatePickerField } from '../../../components/DatePickerField';
import { createAliado, listAliados } from '../../shared/project/aliados-store';
import type {
  DatosBaseProyecto,
  EmpresaEjecutora,
  TipoVenta,
} from '../../shared/project/types';
import { TIPO_VENTA_LABEL } from '../../shared/project/types';
import {
  createUnionTemporal,
  listUnionesTemporales,
} from '../../shared/project/uniones-temporales-store';
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

const EMPRESA_NIT: Record<'Frisson' | 'Verytel', string> = {
  Frisson: '901800001-1',
  Verytel: '830000001-8',
};

type ParticipacionRow = DatosBaseProyecto['unionesTemporales'][number];

function rowKind(row: ParticipacionRow): EmpresaEjecutora {
  if (row.kind) return row.kind;
  if (row.aliadoId) return 'Aliado';
  if (row.unionTemporalId) return 'UT';
  if (row.nombre === EMPRESA_NOMBRE.Frisson || row.nombre === 'Frisson S.A.S.') {
    return 'Frisson';
  }
  if (row.nombre === EMPRESA_NOMBRE.Verytel) return 'Verytel';
  if (row.nombre === EMPRESA_NOMBRE.Aliado) return 'Aliado';
  return 'UT';
}

function resolveRowNit(
  kind: EmpresaEjecutora,
  row: ParticipacionRow,
  catalog: { id: string; nit: string; nombre: string }[],
): string {
  if (kind === 'Frisson' || kind === 'Verytel') return EMPRESA_NIT[kind];
  const selectedId = kind === 'Aliado' ? row.aliadoId : row.unionTemporalId;
  const byId = selectedId
    ? catalog.find((item) => item.id === selectedId)
    : undefined;
  if (byId) return byId.nit;
  return catalog.find((item) => item.nombre === row.nombre)?.nit ?? '';
}

function selectableNombre(emp: EmpresaEjecutora, prev?: ParticipacionRow): string {
  if (emp !== 'UT' && emp !== 'Aliado') return EMPRESA_NOMBRE[emp];
  if (!prev) return '';
  if (prev.nombre === EMPRESA_NOMBRE[emp]) return '';
  return prev.nombre;
}

function syncParticipaciones(
  selected: EmpresaEjecutora[],
  current: ParticipacionRow[],
): ParticipacionRow[] {
  if (selected.length === 0) return [];

  const byEmpresa = new Map<EmpresaEjecutora, ParticipacionRow>();
  for (const row of current) {
    byEmpresa.set(rowKind(row), row);
  }

  const equal = Math.floor(100 / selected.length);
  let remainder = 100 - equal * selected.length;

  return selected.map((emp, index) => {
    const prev = byEmpresa.get(emp);
    let pct = prev?.participacionPct ?? (selected.length === 1 ? 100 : equal);
    if (prev === undefined && selected.length > 1 && remainder > 0 && index === 0) {
      pct = equal + remainder;
      remainder = 0;
    }
    return {
      kind: emp,
      nombre: selectableNombre(emp, prev),
      participacionPct: pct,
      unionTemporalId: emp === 'UT' ? prev?.unionTemporalId : undefined,
      aliadoId: emp === 'Aliado' ? prev?.aliadoId : undefined,
    };
  });
}

type CatalogOption = { id: string; nombre: string };

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
};

const iconButtonClass =
  'grid h-9 w-9 place-items-center btn-glow-outline !border-0';

/** C6 — HU-F04 form, reused by HU-F06 "Ampliar proyecto". */
export function FormularioDatosProyecto({
  datos,
  modo,
  onChange,
}: Props) {
  const [utCatalog, setUtCatalog] = useState(listUnionesTemporales);
  const [aliadoCatalog, setAliadoCatalog] = useState(listAliados);
  const [crearModal, setCrearModal] = useState<'UT' | 'Aliado' | null>(null);
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

  function setRowSelection(
    index: number,
    kind: 'UT' | 'Aliado',
    selected: { id: string; nombre: string } | null,
  ) {
    const next = [...datos.unionesTemporales];
    const row = next[index];
    if (!row) return;
    next[index] = {
      ...row,
      kind,
      nombre: selected?.nombre ?? '',
      unionTemporalId: kind === 'UT' ? selected?.id : undefined,
      aliadoId: kind === 'Aliado' ? selected?.id : undefined,
    };
    patch({ unionesTemporales: next });
  }

  function applyCreated(
    kind: 'UT' | 'Aliado',
    created: { id: string; nombre: string },
  ) {
    const index = datos.unionesTemporales.findIndex(
      (row) => rowKind(row) === kind,
    );
    if (index >= 0) {
      setRowSelection(index, kind, created);
    }
    setCrearModal(null);
  }

  const empresaSection = (
    <section className={cardClass}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">Empresa ejecutora / UT</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={iconButtonClass}
            aria-label="Crear unión temporal"
            title="Crear unión temporal"
            onClick={() => setCrearModal('UT')}
          >
            <Building2 size={20} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={iconButtonClass}
            aria-label="Crear aliado"
            title="Crear aliado"
            onClick={() => setCrearModal('Aliado')}
          >
            <Handshake size={20} strokeWidth={2} />
          </button>
        </div>
      </div>
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
          <div className="rounded border border-border bg-bg">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="w-40 border-r border-border px-4 py-2 font-bold">
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
                  const kind = rowKind(row);
                  const catalog = kind === 'Aliado' ? aliadoCatalog : utCatalog;
                  const selectedId =
                    kind === 'Aliado'
                      ? (row.aliadoId ??
                        aliadoCatalog.find((item) => item.nombre === row.nombre)
                          ?.id ??
                        '')
                      : (row.unionTemporalId ??
                        utCatalog.find((item) => item.nombre === row.nombre)
                          ?.id ??
                        '');
                  const isSelectable = kind === 'UT' || kind === 'Aliado';
                  const nit = resolveRowNit(kind, row, catalog);
                  return (
                    <tr
                      key={`${kind}-${row.unionTemporalId ?? row.aliadoId ?? row.nombre}-${i}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="border-r border-border px-4 py-2 text-muted">
                        {nit || '—'}
                      </td>
                      <td className="border-r border-border px-4 py-2 text-ink">
                        {isSelectable ? (
                          <TableSelect
                            label={
                              kind === 'Aliado' ? 'Aliado' : 'Unión temporal'
                            }
                            value={selectedId}
                            options={catalog}
                            onChange={(next) =>
                              setRowSelection(i, kind, next)
                            }
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
                            className="h-8 w-12 bg-transparent text-center text-sm text-ink outline-none"
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
              La suma de % de ingresos debe ser 100% (actual: {pctSum}%)
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Suma de participación: {pctSum}%
            </p>
          )}
        </>
      )}
      {crearModal === 'UT' ? (
        <CrearEmpresaExternaModal
          title="Unión temporal"
          nitId="ut-nit"
          nombreId="ut-nombre"
          onClose={() => setCrearModal(null)}
          onCreate={createUnionTemporal}
          onCreated={(created) => {
            setUtCatalog(listUnionesTemporales());
            applyCreated('UT', created);
          }}
        />
      ) : null}
      {crearModal === 'Aliado' ? (
        <CrearEmpresaExternaModal
          title="Aliado"
          nitId="aliado-nit"
          nombreId="aliado-nombre"
          onClose={() => setCrearModal(null)}
          onCreate={createAliado}
          onCreated={(created) => {
            setAliadoCatalog(listAliados());
            applyCreated('Aliado', created);
          }}
        />
      ) : null}
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
