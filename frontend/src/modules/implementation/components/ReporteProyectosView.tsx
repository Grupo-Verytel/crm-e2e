import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { listVentasGanadas } from '../../shared/project/mock-store';
import { AlertaBadge } from '../../shared/project/AlertaBadge';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Tab = 'trazabilidad' | 'ejecucion';

/** C5 — HU-F05 + HU-F07 shared reportes view. */
export function ReporteProyectosView() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('trazabilidad');
  const [draft, setDraft] = useState({ q: '', oportunidad: '', cliente: '', vendedor: '' });
  const [applied, setApplied] = useState(draft);

  const all = useMemo(
    () => listVentasGanadas().filter((v) => v.envioPmo.estado === 'Enviado'),
    [],
  );

  const filtered = useMemo(() => {
    let list = all;
    const q = applied.q.toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          v.consecutivo.toLowerCase().includes(q) ||
          v.datosBase.nombreProyecto.toLowerCase().includes(q),
      );
    }
    if (applied.oportunidad) {
      list = list.filter((v) => v.consecutivo.includes(applied.oportunidad));
    }
    if (applied.cliente) {
      list = list.filter((v) =>
        v.empresaNombre.toLowerCase().includes(applied.cliente.toLowerCase()),
      );
    }
    if (applied.vendedor) {
      list = list.filter((v) =>
        v.vendedorNombre.toLowerCase().includes(applied.vendedor.toLowerCase()),
      );
    }
    if (user?.role_name === 'EjecutivoComercial') {
      list = list.filter((v) => v.vendedorNombre === user.full_name);
    }
    return list;
  }, [all, applied, user]);

  const tabClass = (t: Tab) =>
    `-mb-px border-b-2 px-4 py-2 text-sm ${
      tab === t ? 'border-accent font-bold text-accent' : 'border-transparent text-muted'
    }`;

  return (
    <div>
      <div className="mb-4 flex border-b border-border">
        <button type="button" className={tabClass('trazabilidad')} onClick={() => setTab('trazabilidad')}>
          Trazabilidad
        </button>
        <button type="button" className={tabClass('ejecucion')} onClick={() => setTab('ejecucion')}>
          Ejecución por contexto comercial
        </button>
      </div>

      <div className={`${cardClass} mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
        <div>
          <label className={labelClass}>Buscar</label>
          <input className={inputClass} value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        </div>
        {tab === 'ejecucion' ? (
          <>
            <div>
              <label className={labelClass}>Oportunidad</label>
              <input className={inputClass} value={draft.oportunidad} onChange={(e) => setDraft({ ...draft, oportunidad: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Cliente</label>
              <input className={inputClass} value={draft.cliente} onChange={(e) => setDraft({ ...draft, cliente: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Vendedor</label>
              <input className={inputClass} value={draft.vendedor} onChange={(e) => setDraft({ ...draft, vendedor: e.target.value })} />
            </div>
          </>
        ) : null}
        <div className="flex items-end gap-2">
          <button type="button" className={primaryButtonClass} onClick={() => setApplied({ ...draft })}>
            Aplicar filtros
          </button>
          <button type="button" className={ghostButtonClass} onClick={() => { setDraft({ q: '', oportunidad: '', cliente: '', vendedor: '' }); setApplied({ q: '', oportunidad: '', cliente: '', vendedor: '' }); }}>
            Limpiar
          </button>
        </div>
      </div>

      <div className={`${cardClass} overflow-x-auto p-0`}>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              {tab === 'trazabilidad' ? (
                <>
                  <th className="px-4 py-3">ID Oportunidad (CRM)</th>
                  <th className="px-4 py-3">Nombre homologado</th>
                  <th className="px-4 py-3">Consecutivo CP</th>
                  <th className="px-4 py-3">SER</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Fecha</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3">SER</th>
                  <th className="px-4 py-3">Proyecto</th>
                  <th className="px-4 py-3">Oportunidad</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Estado</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Envía una OUV demo desde Oferta & Cierre para ver proyectos aquí.
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.ouvId} className="border-b border-border hover:bg-accent/5">
                  {tab === 'trazabilidad' ? (
                    <>
                      <td className="px-4 py-3 font-bold text-accent">{v.consecutivo}</td>
                      <td className="px-4 py-3">{v.datosBase.nombreProyecto}</td>
                      <td className="px-4 py-3">{v.envioPmo.consecutivoControlProyectos}</td>
                      <td className="px-4 py-3">
                        <Link to={`/services/${v.ouvId}`} className="text-accent hover:underline">
                          {v.envioPmo.serConsecutivo}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{v.empresaNombre}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {v.envioPmo.enviadoEn ? new Date(v.envioPmo.enviadoEn).toLocaleDateString('es-CO') : '—'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <Link to={`/services/${v.ouvId}`} className="font-bold text-accent hover:underline">
                          {v.envioPmo.serConsecutivo}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{v.datosBase.nombreProyecto}</td>
                      <td className="px-4 py-3">{v.consecutivo}</td>
                      <td className="px-4 py-3">{v.empresaNombre}</td>
                      <td className="px-4 py-3">{v.vendedorNombre}</td>
                      <td className="px-4 py-3">{v.indicadores.ejecucion.estado}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.some((v) => v.alertas.some((a) => a.tipo.includes('duplic'))) ? (
        <div className="mt-4">
          <AlertaBadge
            alerta={{
              id: 'dup',
              tipo: 'Posible duplicado',
              estado: 'Activa',
              descripcion: 'Un mismo ID de oportunidad no debe generar más de un proyecto.',
              fecha: new Date().toISOString(),
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
