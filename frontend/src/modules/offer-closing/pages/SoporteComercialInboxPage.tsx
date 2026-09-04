import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { formatDateTime } from '../../../lib/format';
import { useAuth } from '../../auth/hooks/useAuth';
import { fetchOuvs } from '../../discovery/api/ouvs-api';
import { createVentaFromOuvApi } from '../../shared/project/mock-data';
import {
  listVentasGanadas,
  mergeApiVentas,
} from '../../shared/project/mock-store';
import type { VentaGanadaRecord } from '../../shared/project/types';
import { TIPO_VENTA_LABEL, VALIDACION_TIPOS } from '../../shared/project/types';
import { OfferClosingNav } from '../components/OfferClosingNav';
import { ValidacionBadge } from '../components/ValidacionBadge';
import {
  badgeClass,
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';

type DraftFilters = {
  q: string;
  tipoVenta: string;
  estadoRevision: string;
};

const EMPTY: DraftFilters = { q: '', tipoVenta: '', estadoRevision: '' };

/** HU-F01 — Bandeja soporte comercial (ventas ganadas → validación → PMO). */
export function SoporteComercialInboxPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DraftFilters>(EMPTY);
  const [applied, setApplied] = useState<DraftFilters>(EMPTY);
  const [items, setItems] = useState<VentaGanadaRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const canAll =
        user?.role_name === 'SoporteComercial' || user?.role_name === 'Admin';
      if (canAll) {
        try {
          const res = await fetchOuvs({ resultado: 'Ganada', all: true, limit: 50 });
          const fromApi = res.items.map((o) =>
            createVentaFromOuvApi(o, user?.full_name ?? 'Comercial'),
          );
          mergeApiVentas(fromApi);
        } catch {
          /* API optional — demo mocks still work */
        }
      }
      let list = listVentasGanadas().filter((v) => v.envioPmo.estado !== 'Enviado');
      if (applied.q.trim()) {
        const q = applied.q.toLowerCase();
        list = list.filter(
          (v) =>
            v.consecutivo.toLowerCase().includes(q) ||
            v.titulo.toLowerCase().includes(q) ||
            v.empresaNombre.toLowerCase().includes(q),
        );
      }
      if (applied.tipoVenta) {
        list = list.filter((v) => v.datosBase.tipoVenta === applied.tipoVenta);
      }
      if (applied.estadoRevision) {
        list = list.filter((v) => v.estadoRevision === applied.estadoRevision);
      }
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [applied, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppLayout title="Oferta & Cierre">
      <OfferClosingNav />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Bandeja soporte comercial</h1>
          <p className="text-sm text-muted">
            Ventas ganadas pendientes de validación antes de Control de Proyectos (mock).
          </p>
        </div>
      </div>

      <div className={`${cardClass} mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
        <div>
          <label className={labelClass}>Buscar</label>
          <input
            className={inputClass}
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            placeholder="OUV, título, cliente…"
          />
        </div>
        <div>
          <label className={labelClass}>Tipo de venta</label>
          <select
            className={inputClass}
            value={draft.tipoVenta}
            onChange={(e) => setDraft({ ...draft, tipoVenta: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="Licitacion">Licitación</option>
            <option value="VentaDirecta">Venta directa</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Estado revisión</label>
          <select
            className={inputClass}
            value={draft.estadoRevision}
            onChange={(e) => setDraft({ ...draft, estadoRevision: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="Pendiente">Pendiente</option>
            <option value="EnRevision">En revisión</option>
            <option value="Aprobada">Aprobada</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => setApplied({ ...draft })}
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            className={ghostButtonClass}
            onClick={() => {
              setDraft(EMPTY);
              setApplied(EMPTY);
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className={`${cardClass} overflow-x-auto p-0`}>
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="px-4 py-3">Consecutivo</th>
              <th className="px-4 py-3">Título / Empresa</th>
              <th className="px-4 py-3">Vendedor</th>
              <th className="px-4 py-3">Tipo venta</th>
              <th className="px-4 py-3">Revisión</th>
              <th className="px-4 py-3">Validaciones</th>
              <th className="px-4 py-3">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No hay ventas ganadas pendientes. Usa las OUV demo o marca una OUV como Ganada en Oportunidades.
                </td>
              </tr>
            ) : (
              items.map((v) => (
                <tr
                  key={v.ouvId}
                  className="cursor-pointer border-b border-border hover:bg-accent/5"
                  onClick={() => navigate(`/offers/${v.ouvId}`)}
                >
                  <td className="px-4 py-3 font-bold text-accent">{v.consecutivo}</td>
                  <td className="px-4 py-3">
                    <p className="font-bold">{v.titulo}</p>
                    <p className="text-xs text-muted">{v.empresaNombre}</p>
                  </td>
                  <td className="px-4 py-3">{v.vendedorNombre}</td>
                  <td className="px-4 py-3">{TIPO_VENTA_LABEL[v.datosBase.tipoVenta]}</td>
                  <td className="px-4 py-3">
                    <span className={`${badgeClass} bg-border text-ink`}>{v.estadoRevision}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {VALIDACION_TIPOS.map((t) => (
                        <ValidacionBadge key={t} tipo={t} estado={v.validaciones[t].estado} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {formatDateTime(v.updatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

export default SoporteComercialInboxPage;
