import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../../../layout/AppLayout';
import { ApiError } from '../../auth/types';
import {
  createZonaChecklistTemplate,
  deleteZonaChecklistTemplate,
  fetchZonaChecklistTemplates,
  updateZonaChecklistTemplate,
  type TemplatePayload,
  type ZonaChecklistTemplate,
} from '../api/catalogos-api';
import { DiscoveryNav } from '../components/DiscoveryNav';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';
import { OUV_ZONA_LABEL, OUV_ZONAS, type OuvZona } from '../lib/ouv-vocab';

export function ZonaChecklistAdminPage() {
  const [items, setItems] = useState<ZonaChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ZonaChecklistTemplate | null | 'new'>(
    null,
  );
  const [zona, setZona] = useState<OuvZona>('UNIVERSO');
  const [codigo, setCodigo] = useState('');
  const [label, setLabel] = useState('');
  const [orden, setOrden] = useState('0');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchZonaChecklistTemplates());
    } catch {
      setError('No se pudieron cargar las plantillas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setEditing('new');
    setZona('UNIVERSO');
    setCodigo('');
    setLabel('');
    setOrden('0');
  }

  function openEdit(row: ZonaChecklistTemplate) {
    setEditing(row);
    setZona(row.zona);
    setCodigo(row.codigo_item);
    setLabel(row.label);
    setOrden(String(row.orden));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: TemplatePayload = {
      zona,
      codigo_item: codigo.trim(),
      label: label.trim(),
      orden: Number(orden) || 0,
    };
    try {
      if (editing === 'new') {
        await createZonaChecklistTemplate(payload);
      } else if (editing) {
        await updateZonaChecklistTemplate(editing.template_id, payload);
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

  async function onDelete(row: ZonaChecklistTemplate) {
    if (!window.confirm(`¿Eliminar "${row.label}"?`)) return;
    try {
      await deleteZonaChecklistTemplate(row.template_id);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo eliminar.',
      );
    }
  }

  return (
    <AppLayout title="Checklist por zona">
      <DiscoveryNav />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">
          Plantillas checklist por zona
        </h1>
        <button type="button" className={primaryButtonClass} onClick={openNew}>
          Nueva plantilla
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
                <th className="px-3 py-2">Zona</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Orden</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.template_id} className="border-b border-border">
                  <td className="px-3 py-2 text-ink">
                    {OUV_ZONA_LABEL[row.zona] ?? row.zona}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-ink">
                    {row.codigo_item}
                  </td>
                  <td className="px-3 py-2 text-ink">{row.label}</td>
                  <td className="px-3 py-2 text-ink">{row.orden}</td>
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
            <p className="p-4 text-sm text-muted">
              Sin plantillas. Sin ellas el checklist de OUVs nace vacío.
            </p>
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
              {editing === 'new' ? 'Nueva plantilla' : 'Editar plantilla'}
            </h2>
            <div>
              <label className={labelClass}>Zona</label>
              <select
                className={inputClass}
                value={zona}
                onChange={(e) => setZona(e.target.value as OuvZona)}
              >
                {OUV_ZONAS.map((z) => (
                  <option key={z} value={z}>
                    {OUV_ZONA_LABEL[z]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Código</label>
              <input
                className={inputClass}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
                maxLength={60}
              />
            </div>
            <div>
              <label className={labelClass}>Label</label>
              <input
                className={inputClass}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                maxLength={200}
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

export default ZonaChecklistAdminPage;
