import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchAccounts } from '../../accounts/api/accounts-api';
import type { Account } from '../../accounts/types';
import { fetchUsers } from '../../auth/api/users-api';
import type { User } from '../../auth/types';
import { ApiError } from '../../auth/types';
import { fetchSegments } from '../../demand-generation/api/segments-api';
import type { Segment } from '../../demand-generation/types';
import type { Ouv, UpdateOuvPayload } from '../api/ouvs-api';
import { SEGMENTOS, VERTICALES } from '../lib/ouv-vocab';
import { ModalShell } from './ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  ouv: Ouv;
  /** Rol del actor; solo Admin puede reasignar el comercial dueño. */
  actorRoleName: string | undefined;
  onClose: () => void;
  onSaved: (updated: Ouv) => void;
  save: (payload: UpdateOuvPayload) => Promise<Ouv>;
};

/**
 * Modal para editar todos los metadatos y relaciones editables de una OUV:
 * cabecera (título, empresa, segmento, vertical, descripción), account
 * vinculada, segmento estructurado (segment_id + subsegment_id), y —solo si
 * el actor es Admin— reasignación del comercial dueño. Zona, resultado y
 * presupuesto tienen sus propios flujos y NO se editan desde aquí.
 */
export function EditOuvModal({
  ouv,
  actorRoleName,
  onClose,
  onSaved,
  save,
}: Props) {
  const [titulo, setTitulo] = useState(ouv.titulo ?? '');
  const [empresa, setEmpresa] = useState(ouv.empresa_nombre ?? '');
  const [segmento, setSegmento] = useState(ouv.segmento ?? '');
  const [vertical, setVertical] = useState(ouv.vertical ?? '');
  const [descripcion, setDescripcion] = useState(ouv.descripcion ?? '');
  const [accountId, setAccountId] = useState<string>(ouv.account_id ?? '');
  const [segmentId, setSegmentId] = useState<string>(ouv.segment_id ?? '');
  const [subsegmentId, setSubsegmentId] = useState<string>(
    ouv.subsegment_id ?? '',
  );
  const [comercialId, setComercialId] = useState<string>(ouv.comercial_id ?? '');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [comerciales, setComerciales] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);

  const isAdmin = actorRoleName === 'Admin';

  useEffect(() => {
    let cancelled = false;
    async function loadCatalogs() {
      try {
        const [accountsPage, segmentsList, usersPage] = await Promise.all([
          // Traemos un tramo grande porque el select vive en un modal — si la
          // cuenta de accounts supera esto habrá que reemplazarlo por combobox
          // con búsqueda paginada.
          fetchAccounts({ limit: 500 }),
          fetchSegments(),
          isAdmin ? fetchUsers({ limit: 500 }) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setAccounts(accountsPage.items);
        setSegments(segmentsList);
        if (usersPage) {
          setComerciales(
            usersPage.items.filter(
              (u) => u.role_name === 'EjecutivoComercial' && u.is_active,
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setError('No se pudieron cargar los catálogos.');
        }
      } finally {
        if (!cancelled) setLoadingCatalogs(false);
      }
    }
    void loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const selectedSegment = useMemo(
    () => segments.find((s) => s.id === segmentId) ?? null,
    [segments, segmentId],
  );

  function handleSegmentChange(nextId: string) {
    setSegmentId(nextId);
    // Reset subsegmento si ya no pertenece al segmento elegido.
    const next = segments.find((s) => s.id === nextId);
    if (!next || !next.subsegments.some((ss) => ss.id === subsegmentId)) {
      setSubsegmentId('');
    }
  }

  const payload = useMemo<UpdateOuvPayload>(() => {
    const diff: UpdateOuvPayload = {};
    const t = titulo.trim();
    const e = empresa.trim();
    const d = descripcion.trim();
    if (t !== (ouv.titulo ?? '').trim()) diff.titulo = t;
    if (e !== (ouv.empresa_nombre ?? '').trim()) diff.empresa_nombre = e;
    if (segmento !== ouv.segmento) diff.segmento = segmento;
    if (vertical !== ouv.vertical) diff.vertical = vertical;
    if (d !== (ouv.descripcion ?? '').trim()) diff.descripcion = d;

    const nextAccountId = accountId || null;
    if (nextAccountId !== (ouv.account_id ?? null)) {
      diff.account_id = nextAccountId;
    }
    const nextSegmentId = segmentId || null;
    if (nextSegmentId !== (ouv.segment_id ?? null)) {
      diff.segment_id = nextSegmentId;
    }
    const nextSubsegmentId = subsegmentId || null;
    if (nextSubsegmentId !== (ouv.subsegment_id ?? null)) {
      diff.subsegment_id = nextSubsegmentId;
    }
    if (isAdmin && comercialId && comercialId !== ouv.comercial_id) {
      diff.comercial_id = comercialId;
    }
    return diff;
  }, [
    titulo,
    empresa,
    segmento,
    vertical,
    descripcion,
    accountId,
    segmentId,
    subsegmentId,
    comercialId,
    isAdmin,
    ouv,
  ]);

  const hasChanges = Object.keys(payload).length > 0;
  const canSave = hasChanges && titulo.trim() !== '' && empresa.trim() !== '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await save(payload);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'No se pudo actualizar la OUV.');
      } else {
        setError('No se pudo actualizar la OUV.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Editar OUV" onClose={onClose} size="wide">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className={labelClass} htmlFor="edit-ouv-titulo">
            Título
          </label>
          <input
            id="edit-ouv-titulo"
            className={inputClass}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="edit-ouv-empresa">
            Empresa / cuenta (snapshot)
          </label>
          <input
            id="edit-ouv-empresa"
            className={inputClass}
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            maxLength={200}
            required
          />
          <p className="mt-1 text-xs text-muted">
            Texto plano de referencia. Si vinculás una account abajo y no tocás
            este campo, se sincroniza al nombre de la account.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="edit-ouv-account">
            Account vinculada
          </label>
          <select
            id="edit-ouv-account"
            className={inputClass}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={loadingCatalogs}
          >
            <option value="">Sin account vinculada</option>
            {accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.name}
                {a.tax_id ? ` · ${a.tax_id}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="edit-ouv-segmento">
              Segmento (arquetipo)
            </label>
            <select
              id="edit-ouv-segmento"
              className={inputClass}
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
            >
              {SEGMENTOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-ouv-vertical">
              Vertical
            </label>
            <select
              id="edit-ouv-vertical"
              className={inputClass}
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
            >
              {VERTICALES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="edit-ouv-segment">
              Segmento estructurado
            </label>
            <select
              id="edit-ouv-segment"
              className={inputClass}
              value={segmentId}
              onChange={(e) => handleSegmentChange(e.target.value)}
              disabled={loadingCatalogs}
            >
              <option value="">Sin segmento estructurado</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-ouv-subsegment">
              Subsegmento
            </label>
            <select
              id="edit-ouv-subsegment"
              className={inputClass}
              value={subsegmentId}
              onChange={(e) => setSubsegmentId(e.target.value)}
              disabled={loadingCatalogs || !selectedSegment}
            >
              <option value="">
                {selectedSegment ? 'Sin subsegmento' : '(elige segmento)'}
              </option>
              {selectedSegment?.subsegments.map((ss) => (
                <option key={ss.id} value={ss.id}>
                  {ss.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isAdmin ? (
          <div>
            <label className={labelClass} htmlFor="edit-ouv-comercial">
              Comercial dueño
            </label>
            <select
              id="edit-ouv-comercial"
              className={inputClass}
              value={comercialId}
              onChange={(e) => setComercialId(e.target.value)}
              disabled={loadingCatalogs}
            >
              {comerciales.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.full_name} · {u.email}
                </option>
              ))}
              {!comerciales.some((u) => u.user_id === ouv.comercial_id) &&
              ouv.comercial_id ? (
                <option value={ouv.comercial_id}>
                  (dueño actual, no listado)
                </option>
              ) : null}
            </select>
            <p className="mt-1 text-xs text-muted">
              Reasigna la propiedad del OUV. Solo Admin puede hacerlo.
            </p>
          </div>
        ) : null}

        <div>
          <label className={labelClass} htmlFor="edit-ouv-descripcion">
            Descripción
          </label>
          <textarea
            id="edit-ouv-descripcion"
            className={`${inputClass} h-24 resize-y py-2`}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className={ghostButtonClass}
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={!canSave || saving}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
