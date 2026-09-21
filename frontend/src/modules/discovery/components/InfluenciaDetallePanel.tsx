import { Plus, X } from 'lucide-react';
import type { OuvContacto, OuvInfluencia } from '../api/ouvs-api';
import {
  INFLUENCIA_ESTADO_LABEL,
  INFLUENCIA_TIPO_LABEL,
  influenciaAvatarRingClass,
  type InfluenciaEstado,
  type InfluenciaTipo,
} from '../lib/ouv-vocab';
import { contactInitials } from './InfluenciaCard';
import { EstadoSegmentedControl } from './EstadoSegmentedControl';
import { inputClass, labelClass } from './ui';

export type InfluenciaFieldPatch = Partial<
  Pick<OuvInfluencia, 'estado' | 'contacto_ouv_id' | 'notas' | 'motivo_estado'>
>;

type Props = {
  tipo: InfluenciaTipo;
  inf: OuvInfluencia | undefined;
  assignedContact: OuvContacto | undefined;
  contactos: OuvContacto[];
  editable: boolean;
  isSaving: boolean;
  justSaved: boolean;
  onFieldChange: (tipo: InfluenciaTipo, patch: InfluenciaFieldPatch) => void;
  onNotasChange: (tipo: InfluenciaTipo, notas: string) => void;
  onNotasBlur: (tipo: InfluenciaTipo) => void;
  onAddContact: (tipo: InfluenciaTipo) => void;
};

function contactMeta(contact: OuvContacto): string {
  return [contact.email, contact.phone].filter(Boolean).join(' · ');
}

function estadoToneClass(estado: InfluenciaEstado): string {
  if (estado === 'Verde') return 'text-semaphore-verde';
  if (estado === 'Amarillo') return 'text-warning';
  if (estado === 'Rojo') return 'text-danger';
  return 'text-muted';
}

export function InfluenciaDetallePanel({
  tipo,
  inf,
  assignedContact,
  contactos,
  editable,
  isSaving,
  justSaved,
  onFieldChange,
  onNotasChange,
  onNotasBlur,
  onAddContact,
}: Props) {
  const label = INFLUENCIA_TIPO_LABEL[tipo] ?? tipo;
  const estado =
    (inf?.estado as InfluenciaEstado | undefined) ?? 'SinEvaluar';
  const estadoLabel = INFLUENCIA_ESTADO_LABEL[estado];
  const hasContact = Boolean(assignedContact);
  const missingContactForVerde = estado === 'Verde' && !inf?.contacto_ouv_id;
  const meta = assignedContact ? contactMeta(assignedContact) : '';
  const ringClass = influenciaAvatarRingClass(estado, hasContact);

  return (
    <div
      className="toast-fade-in rounded-lg border border-border p-3"
      role="region"
      aria-label={`Detalle de influencia ${label}`}
    >
      <div className="relative mb-3">
        <div className="absolute right-0 top-0 z-10 flex items-center gap-2">
          {isSaving ? (
            <span className="text-xs font-bold text-accent">Guardando…</span>
          ) : null}
          {!isSaving && justSaved ? (
            <span className="text-xs font-bold text-positive">Guardado</span>
          ) : null}
          {assignedContact && editable ? (
            <button
              type="button"
              className="icon-btn grid h-6 w-6 place-items-center rounded text-muted hover:text-danger"
              aria-label={`Quitar contacto de ${label}`}
              onClick={() => onFieldChange(tipo, { contacto_ouv_id: null })}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
        <div
          className={[
            'flex items-start justify-between gap-8',
            assignedContact && editable ? 'pr-8' : '',
          ].join(' ')}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={[
                'grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-xs font-bold',
                ringClass,
              ].join(' ')}
              title={`Estado: ${estadoLabel}`}
              aria-label={`Estado: ${estadoLabel}`}
            >
              {assignedContact ? (
                contactInitials(assignedContact.name)
              ) : (
                <Plus size={16} strokeWidth={2.25} aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-6 text-ink">
                {label}
                <span className="font-normal text-muted"> · </span>
                <span className={estadoToneClass(estado)}>{estadoLabel}</span>
              </p>
              {assignedContact ? (
                <>
                  <p className="truncate text-sm text-ink">
                    <span className="font-bold">{assignedContact.name}</span>
                    {assignedContact.job_title ? (
                      <span className="font-normal text-muted">
                        {' '}
                        · {assignedContact.job_title}
                      </span>
                    ) : null}
                  </p>
                  {meta ? (
                    <p className="truncate text-xs text-muted" title={meta}>
                      {meta}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs italic text-muted">Sin asignar</p>
              )}
            </div>
          </div>

          <div
            className={[
              'flex shrink-0 flex-col items-end gap-1.5',
              assignedContact && editable ? 'pt-7' : '',
            ].join(' ')}
          >
            <label
              className="text-xs font-bold text-ink"
              id={`influencia-estado-${tipo}-label`}
            >
              Estado
            </label>
            <EstadoSegmentedControl
              id={`influencia-estado-${tipo}`}
              labelledBy={`influencia-estado-${tipo}-label`}
              value={estado}
              disabled={!editable}
              onChange={(next) => onFieldChange(tipo, { estado: next })}
            />
          </div>
        </div>
      </div>

      {!assignedContact ? (
        <div className="mb-3">
          <label className={labelClass} htmlFor={`influencia-contacto-${tipo}`}>
            Contacto
          </label>
          <select
            id={`influencia-contacto-${tipo}`}
            className={`${inputClass} text-muted`}
            disabled={!editable}
            value={inf?.contacto_ouv_id ?? ''}
            onChange={(e) =>
              onFieldChange(tipo, {
                contacto_ouv_id: e.target.value || null,
              })
            }
          >
            <option value="">Sin asignar</option>
            {contactos.map((c) => (
              <option key={c.contacto_ouv_id} value={c.contacto_ouv_id}>
                {c.name}
              </option>
            ))}
          </select>
          {editable ? (
            <button
              type="button"
              className="mt-1 text-xs font-bold text-accent hover:underline"
              onClick={() => onAddContact(tipo)}
            >
              + Agregar contacto
            </button>
          ) : null}
        </div>
      ) : null}

      {missingContactForVerde ? (
        <p className="mb-3 text-xs text-warning" role="status">
          Asigna un contacto para que esta influencia cuente al avanzar.
        </p>
      ) : null}

      <label className={labelClass} htmlFor={`influencia-notas-${tipo}`}>
        Notas
      </label>
      <textarea
        id={`influencia-notas-${tipo}`}
        className={`${inputClass} h-16 py-2`}
        disabled={!editable}
        value={inf?.notas ?? ''}
        onChange={(e) => onNotasChange(tipo, e.target.value)}
        onBlur={() => onNotasBlur(tipo)}
      />
    </div>
  );
}
