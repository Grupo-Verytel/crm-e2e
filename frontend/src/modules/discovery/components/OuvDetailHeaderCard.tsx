import { useEffect, useRef, useState } from 'react';
import { formatDateTime } from '../../../lib/format';
import type { Ouv } from '../api/ouvs-api';
import type { OuvDetailExtensions } from '../lib/ouv-detail-extensions';
import {
  buildOuvMetaFields,
  RESULTADO_LABEL,
  SEGMENTO_LABEL,
} from '../lib/ouv-detail-meta';
import { SEGMENTOS, VERTICALES } from '../lib/ouv-vocab';
import { GapBadge, ResultadoBadge } from './OuvBadges';
import { OuvConfigMenu } from './OuvConfigMenu';
import { cardClass, inputClass, labelClass } from './ui';

export type OuvHeaderDraft = {
  titulo: string;
  empresa_nombre: string;
  segmento: string;
  vertical: string;
  descripcion: string;
  extensions: OuvDetailExtensions;
};

type Props = {
  ouv: Ouv;
  extensions: OuvDetailExtensions;
  editable: boolean;
  editMode: boolean;
  onToggleEditMode: () => void;
  onAvanzar: () => void;
  onRetroceder: () => void;
  onCerrar: () => void;
  onPersist: (draft: OuvHeaderDraft) => Promise<void>;
};

function draftFromOuv(ouv: Ouv, extensions: OuvDetailExtensions): OuvHeaderDraft {
  return {
    titulo: ouv.titulo,
    empresa_nombre: ouv.empresa_nombre,
    segmento: ouv.segmento,
    vertical: ouv.vertical,
    descripcion: ouv.descripcion ?? '',
    extensions: { ...extensions },
  };
}

export function OuvDetailHeaderCard({
  ouv,
  extensions,
  editable,
  editMode,
  onToggleEditMode,
  onAvanzar,
  onRetroceder,
  onCerrar,
  onPersist,
}: Props) {
  const [draft, setDraft] = useState<OuvHeaderDraft>(() =>
    draftFromOuv(ouv, extensions),
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const saveSeq = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!editMode) {
      setDraft(draftFromOuv(ouv, extensions));
    }
  }, [ouv, extensions, editMode]);

  useEffect(() => {
    if (editMode) {
      setDraft(draftFromOuv(ouv, extensions));
    }
  }, [editMode, ouv, extensions]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!editMode && debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      void persistNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush pending save when leaving edit mode
  }, [editMode]);

  function flashSaved() {
    setSavedFlash(true);
    const t = setTimeout(() => setSavedFlash(false), 1400);
    return () => clearTimeout(t);
  }

  async function persistNow() {
    const seq = ++saveSeq.current;
    setSaving(true);
    try {
      await onPersist(draftRef.current);
      if (saveSeq.current !== seq) return;
      flashSaved();
    } finally {
      if (saveSeq.current === seq) setSaving(false);
    }
  }

  function schedulePersist() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void persistNow();
    }, 500);
  }

  function patchDraft(patch: Partial<OuvHeaderDraft>) {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      draftRef.current = next;
      return next;
    });
    schedulePersist();
  }

  function patchExtension(patch: Partial<OuvDetailExtensions>) {
    setDraft((prev) => {
      const next = {
        ...prev,
        extensions: { ...prev.extensions, ...patch },
      };
      draftRef.current = next;
      return next;
    });
    schedulePersist();
  }

  function patchSelect(field: 'segmento' | 'vertical', value: string) {
    setDraft((prev) => {
      const next = { ...prev, [field]: value };
      draftRef.current = next;
      return next;
    });
    void persistNow();
  }

  function patchProyecto(value: '' | 'Recurrente' | 'No recurrente') {
    setDraft((prev) => {
      const next = {
        ...prev,
        extensions: { ...prev.extensions, proyecto: value || undefined },
      };
      draftRef.current = next;
      return next;
    });
    void persistNow();
  }

  const readFields = buildOuvMetaFields(ouv, extensions);

  return (
    <header
      className={[
        cardClass,
        'mb-4 p-4 transition-[box-shadow,border-color] duration-300',
        editMode ? 'ring-1 ring-accent/40' : '',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editMode ? (
            <div>
              <label className={labelClass} htmlFor="ouv-titulo-header">
                Título
              </label>
              <input
                id="ouv-titulo-header"
                className={`${inputClass} text-lg font-bold`}
                value={draft.titulo}
                onChange={(e) => patchDraft({ titulo: e.target.value })}
                maxLength={200}
              />
            </div>
          ) : (
            <h1 className="text-xl font-bold text-ink">{ouv.titulo}</h1>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ResultadoBadge resultado={ouv.resultado} />
            <span className="rounded bg-bg px-2 py-0.5 text-xs font-bold text-ink">
              {ouv.origen_via === 'directa' ? 'Directa' : 'Desde SQL'}
            </span>
            {ouv.tiene_gap ? <GapBadge /> : null}
            {editMode ? (
              <span className="text-xs font-bold text-muted">
                {saving ? 'Guardando…' : savedFlash ? 'Guardado' : 'Edición · autoguardado'}
              </span>
            ) : null}
          </div>
        </div>
        {editable ? (
          <OuvConfigMenu
            editingOuv={editMode}
            onEditar={onToggleEditMode}
            onAvanzar={onAvanzar}
            onRetroceder={onRetroceder}
            onCerrar={onCerrar}
          />
        ) : null}
      </div>

      {editMode ? (
        <div className="mt-3">
          <label className={labelClass} htmlFor="ouv-descripcion">
            Descripción
          </label>
          <textarea
            id="ouv-descripcion"
            className={`${inputClass} h-20 py-2`}
            value={draft.descripcion}
            onChange={(e) => patchDraft({ descripcion: e.target.value })}
            onBlur={() => {
              if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                debounceTimer.current = null;
                void persistNow();
              }
            }}
          />
        </div>
      ) : ouv.descripcion ? (
        <p className="mt-3 text-sm text-muted">{ouv.descripcion}</p>
      ) : null}

      <dl className="mt-4 grid gap-x-4 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {editMode ? (
          <>
            <div>
              <dt className="text-xs font-bold text-muted">OUV ID</dt>
              <dd className="mt-0.5 break-words font-medium text-ink">
                {ouv.ouv_id}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">Consecutivo</dt>
              <dd className="mt-0.5 break-words font-medium text-ink">
                {ouv.consecutivo} · {draft.titulo}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">SQL ID</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {ouv.sql_id_origen ?? '—'}
              </dd>
            </div>
            <div>
              <label className={labelClass} htmlFor="ouv-org">
                Organización
              </label>
              <input
                id="ouv-org"
                className={inputClass}
                value={draft.empresa_nombre}
                onChange={(e) =>
                  patchDraft({ empresa_nombre: e.target.value })
                }
                maxLength={200}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ouv-segmento">
                Segmento
              </label>
              <select
                id="ouv-segmento"
                className={inputClass}
                value={draft.segmento}
                onChange={(e) => patchSelect('segmento', e.target.value)}
              >
                {SEGMENTOS.map((s) => (
                  <option key={s} value={s}>
                    {SEGMENTO_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ouv-vertical">
                Vertical
              </label>
              <select
                id="ouv-vertical"
                className={inputClass}
                value={draft.vertical}
                onChange={(e) => patchSelect('vertical', e.target.value)}
              >
                {VERTICALES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ouv-proyecto">
                Proyecto
              </label>
              <select
                id="ouv-proyecto"
                className={inputClass}
                value={draft.extensions.proyecto ?? ''}
                onChange={(e) =>
                  patchProyecto(
                    e.target.value as '' | 'Recurrente' | 'No recurrente',
                  )
                }
              >
                <option value="">Sin definir</option>
                <option value="Recurrente">Recurrente</option>
                <option value="No recurrente">No recurrente</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="ouv-plazo">
                Plazo ejecución (meses)
              </label>
              <input
                id="ouv-plazo"
                type="number"
                min={0}
                className={inputClass}
                value={draft.extensions.plazo_ejecucion ?? ''}
                onChange={(e) =>
                  patchExtension({ plazo_ejecucion: e.target.value || undefined })
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ouv-prob">
                Probabilidad de cierre (%)
              </label>
              <input
                id="ouv-prob"
                type="number"
                min={0}
                max={100}
                className={inputClass}
                value={draft.extensions.probabilidad_cierre ?? ''}
                onChange={(e) =>
                  patchExtension({
                    probabilidad_cierre: e.target.value || undefined,
                  })
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ouv-ciudad">
                Ciudad
              </label>
              <input
                id="ouv-ciudad"
                className={inputClass}
                value={draft.extensions.ciudad ?? ''}
                onChange={(e) =>
                  patchExtension({ ciudad: e.target.value || undefined })
                }
                maxLength={120}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ouv-region">
                Región
              </label>
              <input
                id="ouv-region"
                className={inputClass}
                value={draft.extensions.region ?? ''}
                onChange={(e) =>
                  patchExtension({ region: e.target.value || undefined })
                }
                maxLength={120}
              />
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">Etapa</dt>
              <dd className="mt-0.5 font-medium text-ink">Comercial</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">Estado OUV</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {RESULTADO_LABEL[ouv.resultado] ?? ouv.resultado}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">Fecha creación</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {formatDateTime(ouv.created_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">
                Fecha actualización
              </dt>
              <dd className="mt-0.5 font-medium text-ink">
                {formatDateTime(ouv.updated_at)}
              </dd>
            </div>
          </>
        ) : (
          readFields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs font-bold text-muted">{field.label}</dt>
              <dd className="mt-0.5 break-words font-medium text-ink">
                {field.value}
              </dd>
            </div>
          ))
        )}
      </dl>
    </header>
  );
}
