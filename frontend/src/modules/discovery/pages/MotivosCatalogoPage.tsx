import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../../../layout/AppLayout';
import { ApiError } from '../../auth/types';
import {
  createMotivoDescarte,
  createMotivoPerdida,
  deleteMotivoDescarte,
  deleteMotivoPerdida,
  fetchMotivosDescarte,
  fetchMotivosPerdida,
  updateMotivoDescarte,
  updateMotivoPerdida,
  type MotivoCatalogo,
  type MotivoPayload,
} from '../api/catalogos-api';
import { DiscoveryNav } from '../components/DiscoveryNav';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';

type Kind = 'perdida' | 'descarte';

type Props = { kind: Kind };

const TITLES: Record<Kind, string> = {
  perdida: 'Motivos de pérdida',
  descarte: 'Motivos de descarte',
};

export function MotivosCatalogoPage({ kind }: Props) {
  const [items, setItems] = useState<MotivoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MotivoCatalogo | null | 'new'>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [requiereDetalle, setRequiereDetalle] = useState(false);
  const [orden, setOrden] = useState('0');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data =
        kind === 'perdida'
          ? await fetchMotivosPerdida()
          : await fetchMotivosDescarte();
      setItems(data);
    } catch {
      setError('No se pudo cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setEditing('new');
    setNombre('');
    setDescripcion('');
    setRequiereDetalle(false);
    setOrden(String((items[items.length - 1]?.orden ?? -1) + 1));
  }

  function openEdit(row: MotivoCatalogo) {
    setEditing(row);
    setNombre(row.nombre);
    setDescripcion(row.descripcion ?? '');
    setRequiereDetalle(row.requiere_detalle);
    setOrden(String(row.orden));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: MotivoPayload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      requiere_detalle: requiereDetalle,
      orden: Number(orden) || 0,
    };
    try {
      if (editing === 'new') {
        if (kind === 'perdida') await createMotivoPerdida(payload);
        else await createMotivoDescarte(payload);
      } else if (editing) {
        if (kind === 'perdida') {
          await updateMotivoPerdida(editing.motivo_id, payload);
        } else {
          await updateMotivoDescarte(editing.motivo_id, payload);
        }
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo guardar.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: MotivoCatalogo) {
    if (!window.confirm(`¿Eliminar "${row.nombre}"?`)) return;
    try {
      if (kind === 'perdida') await deleteMotivoPerdida(row.motivo_id);
      else await deleteMotivoDescarte(row.motivo_id);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo eliminar.',
      );
    }
  }

  return (
    <AppLayout title={TITLES[kind]}>
      <DiscoveryNav />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">{TITLES[kind]}</h1>
        <button type="button" className={primaryButtonClass} onClick={openNew}>
          Nuevo motivo
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-bg text-xs text-muted">
              <tr>
                <th className="px-3 py-2">Orden</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Detalle req.</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.motivo_id} className="border-b border-border">
                  <td className="px-3 py-2 text-ink">{row.orden}</td>
                  <td className="px-3 py-2 text-ink">
                    <p className="font-bold">{row.nombre}</p>
                    {row.descripcion ? (
                      <p className="text-xs text-muted">{row.descripcion}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {row.requiere_detalle ? 'Sí' : 'No'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={ghostButtonClass}
                        onClick={() => openEdit(row)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={ghostButtonClass}
                        onClick={() => void onDelete(row)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted">Sin motivos. Crea el primero.</p>
          ) : null}
        </div>
      )}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4">
          <form
            className="w-full max-w-md space-y-3 rounded bg-surface p-6 shadow-card"
            onSubmit={(e) => void onSubmit(e)}
          >
            <h2 className="text-base font-bold text-ink">
              {editing === 'new' ? 'Nuevo motivo' : 'Editar motivo'}
            </h2>
            <div>
              <label className={labelClass}>Nombre</label>
              <input
                className={inputClass}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div>
              <label className={labelClass}>Descripción</label>
              <textarea
                className={`${inputClass} h-20 py-2`}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Orden</label>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={requiereDetalle}
                onChange={(e) => setRequiereDetalle(e.target.checked)}
              />
              Requiere detalle al cerrar
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={primaryButtonClass}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppLayout>
  );
}

export function MotivosPerdidaPage() {
  return <MotivosCatalogoPage kind="perdida" />;
}

export function MotivosDescartePage() {
  return <MotivosCatalogoPage kind="descarte" />;
}
