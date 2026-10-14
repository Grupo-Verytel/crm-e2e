import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { formatDateTime } from '../../../lib/format';
import type { Ouv } from '../api/ouvs-api';
import {
  proyectoDeOuv,
  type OuvDetailExtensions,
} from '../lib/ouv-detail-extensions';
import {
  buildOuvMetaFields,
  formatOuvOrigin,
  formatOuvSourceChannel,
  SEGMENTO_LABEL,
} from '../lib/ouv-detail-meta';
import { SEGMENTOS, VERTICALES } from '../lib/ouv-vocab';
import { ColombiaCitySearchField } from './ColombiaCitySearchField';
import { GapBadge, ResultadoBadge } from './OuvBadges';
import { OuvConfigMenu } from './OuvConfigMenu';
import { cardClass, inputClass, labelClass } from './ui';

export type OuvHeaderDraft = {
  titulo: string;
  empresa_nombre: string;
  segmento: string;
  vertical: string;
  descripcion: string;
  city: string;
  region: string;
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
  contactosCount: number;
  onOpenContactos: () => void;
};

function draftFromOuv(ouv: Ouv, extensions: OuvDetailExtensions): OuvHeaderDraft {
  return {
    titulo: ouv.titulo,
    empresa_nombre: ouv.empresa_nombre,
    segmento: ouv.segmento,
    vertical: ouv.vertical,
    descripcion: ouv.descripcion ?? '',
    city: ouv.city?.trim() || extensions.ciudad?.trim() || '',
    region: ouv.region?.trim() || extensions.region?.trim() || '',
    extensions: {
      ...extensions,
      proyecto: proyectoDeOuv(ouv.is_recurring, extensions),
    },
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
  contactosCount,
  onOpenContactos,
}: Props) {
  const [draft, setDraft] = useState<OuvHeaderDraft>(() =>
    draftFromOuv(ouv, extensions),
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const saveSeq = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;
  const persistChain = useRef<Promise<void>>(Promise.resolve());
  const editingRef = useRef(false);

  // Hydrate only when edit mode starts. Autosave updates `ouv` / `extensions`
  // while the user is still typing; copying those props back into the draft
  // snaps combos to the previous value and drops fast keystrokes.
  useEffect(() => {
    const entered = editMode && !editingRef.current;
    editingRef.current = editMode;
    if (!entered) return;
    const next = draftFromOuv(ouv, extensions);
    draftRef.current = next;
    setDraft(next);
  }, [editMode, ouv, extensions]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  function flashSaved() {
    setSavedFlash(true);
    const t = setTimeout(() => setSavedFlash(false), 1400);
    return () => clearTimeout(t);
  }

  function commitDraft(next: OuvHeaderDraft) {
    draftRef.current = next;
    setDraft(next);
  }

  function enqueuePersist() {
    persistChain.current = persistChain.current.then(flushPersist, flushPersist);
  }

  useEffect(() => {
    if (!editMode && debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      enqueuePersist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush pending save when leaving edit mode
  }, [editMode]);

  async function flushPersist() {
    const snapshot = draftRef.current;
    const seq = ++saveSeq.current;
    setSaving(true);
    try {
      await onPersistRef.current(snapshot);
      if (saveSeq.current === seq) flashSaved();
    } catch {
      // Parent already reports the error.
    } finally {
      if (saveSeq.current === seq) setSaving(false);
    }
  }

  function schedulePersist() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      enqueuePersist();
    }, 500);
  }

  function patchDraft(patch: Partial<OuvHeaderDraft>) {
    commitDraft({ ...draftRef.current, ...patch });
    schedulePersist();
  }

  function patchExtension(patch: Partial<OuvDetailExtensions>) {
    commitDraft({
      ...draftRef.current,
      extensions: { ...draftRef.current.extensions, ...patch },
    });
    schedulePersist();
  }

  function patchSelect(field: 'segmento' | 'vertical', value: string) {
    commitDraft({ ...draftRef.current, [field]: value });
    enqueuePersist();
  }

  function patchProyecto(value: '' | 'Recurrente' | 'No recurrente') {
    commitDraft({
      ...draftRef.current,
      extensions: {
        ...draftRef.current.extensions,
        proyecto: value || undefined,
      },
    });
    enqueuePersist();
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
            {ouv.tiene_gap ? <GapBadge /> : null}
            {editMode ? (
              <span className="text-xs font-bold text-muted">
                {saving ? 'Guardando…' : savedFlash ? 'Guardado' : 'Edición · autoguardado'}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ResultadoBadge resultado={ouv.resultado} />
          <button
            type="button"
            className="icon-btn relative grid h-9 w-9 place-items-center rounded"
            onClick={onOpenContactos}
            aria-label={`Contactos (${contactosCount})`}
            title="Contactos"
          >
            <Users size={18} strokeWidth={1.75} />
            {contactosCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-0.5 text-[10px] font-bold text-white">
                {contactosCount}
              </span>
            ) : null}
          </button>
          {editable ? (
            <OuvConfigMenu
              editingOuv={editMode}
              onEditar={onToggleEditMode}
              onContactos={onOpenContactos}
              onAvanzar={onAvanzar}
              onRetroceder={onRetroceder}
              onCerrar={onCerrar}
            />
          ) : null}
        </div>
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
                enqueuePersist();
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
              <dt className="text-xs font-bold text-muted">Organización</dt>
              <dd className="mt-0.5 wrap-break-word font-medium text-ink">
                {ouv.empresa_nombre || '—'}
              </dd>
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
              <dt className="text-xs font-bold text-muted">Origen</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {formatOuvOrigin(ouv.origin)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">Canal de origen</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {formatOuvSourceChannel(ouv.source_channel)}
              </dd>
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
              <ColombiaCitySearchField
                id="ouv-ciudad"
                value={draft.city}
                departamento={draft.region}
                onSelect={(row) =>
                  patchDraft({
                    city: row.municipio,
                    region: row.departamento,
                  })
                }
                onClear={() => patchDraft({ city: '', region: '' })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ouv-region">
                Región
              </label>
              <input
                id="ouv-region"
                className={inputClass}
                value={draft.region}
                readOnly
                placeholder="Se completa al elegir la ciudad"
              />
            </div>
            <div>
              <dt className="text-xs font-bold text-muted">Etapa</dt>
              <dd className="mt-0.5 font-medium text-ink">Comercial</dd>
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
