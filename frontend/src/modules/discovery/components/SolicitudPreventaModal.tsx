import { useState } from 'react';
import { ApiError } from '../../auth/types';
import type { Ouv } from '../api/ouvs-api';
import {
  crearSolicitudPreventa,
  type SolicitudPreventa,
} from '../api/solicitudes-preventa-api';
import {
  ACTIVITY_PRIORITIES,
  ACTIVITY_PRIORITY_HINT,
  ACTIVITY_PRIORITY_LABEL,
  SERVICE_COMBOS,
  SERVICE_COMBO_HINT,
  SERVICE_COMBO_LABEL,
  type ActivityPriority,
  type ServiceCombo,
} from '../lib/preventa-vocab';
import { ModalShell } from './ModalShell';
import { ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './ui';

type Props = {
  ouv: Ouv;
  onClose: () => void;
  onCreated: (solicitud: SolicitudPreventa) => void;
};

/**
 * Envía una solicitud de preventa a MEP-LEAN.
 *
 * El formulario captura **solo decisiones de negocio**. La referencia de
 * interacción, la versión de origen y el ETag son autoridad del CRM (§4, P-01)
 * y los emite el backend; el diseño de referencia los pintaba como campos
 * editables y derivaba la referencia en el browser, lo que rompería la
 * identidad de correlación del contrato.
 */
export function SolicitudPreventaModal({ ouv, onClose, onCreated }: Props) {
  const [priority, setPriority] = useState<ActivityPriority>('ASAP');
  const [combo, setCombo] = useState<ServiceCombo>('technical');
  const [subject, setSubject] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeEnviar = sourceContent.trim().length > 0 && !saving;

  async function submit() {
    setSaving(true);
    setError(null);

    try {
      const solicitud = await crearSolicitudPreventa(ouv.ouv_id, {
        priority,
        service_combo: combo,
        subject: subject.trim() || undefined,
        // Sin trim: el contenido original se preserva sin alteración (P-07).
        source_content: sourceContent,
      });
      onCreated(solicitud);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No fue posible enviar la solicitud de preventa.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Solicitar preventa" onClose={onClose} size="wide">
      <div className="space-y-5">
        <p className="text-sm text-muted">
          La solicitud viaja a la fábrica de preventa (MEP-LEAN), que responde
          por hitos. La referencia de la interacción la asigna el CRM.
        </p>

        <fieldset>
          <legend className={labelClass}>Prioridad</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ACTIVITY_PRIORITIES.map((option) => (
              <label
                key={option}
                className={[
                  'flex cursor-pointer flex-col rounded border p-3 text-sm',
                  priority === option
                    ? 'border-brand bg-bg'
                    : 'border-border hover:bg-bg',
                ].join(' ')}
              >
                <span className="flex items-center gap-2 font-bold text-ink">
                  <input
                    type="radio"
                    name="priority"
                    value={option}
                    checked={priority === option}
                    onChange={() => setPriority(option)}
                  />
                  {ACTIVITY_PRIORITY_LABEL[option]}
                </span>
                <span className="mt-1 pl-6 text-xs text-muted">
                  {ACTIVITY_PRIORITY_HINT[option]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelClass}>Servicios solicitados</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SERVICE_COMBOS.map((option) => (
              <label
                key={option}
                className={[
                  'flex cursor-pointer flex-col rounded border p-3 text-sm',
                  combo === option
                    ? 'border-brand bg-bg'
                    : 'border-border hover:bg-bg',
                ].join(' ')}
              >
                <span className="flex items-center gap-2 font-bold text-ink">
                  <input
                    type="radio"
                    name="service_combo"
                    value={option}
                    checked={combo === option}
                    onChange={() => setCombo(option)}
                  />
                  {SERVICE_COMBO_LABEL[option]}
                </span>
                <span className="mt-1 pl-6 text-xs text-muted">
                  {SERVICE_COMBO_HINT[option]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className={labelClass} htmlFor="solicitud-subject">
            Asunto <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="solicitud-subject"
            className={inputClass}
            value={subject}
            maxLength={512}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Diseño técnico para la fase 1"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="solicitud-contenido">
            Contenido de la solicitud
          </label>
          <textarea
            id="solicitud-contenido"
            className={`${inputClass} h-32 resize-y py-2`}
            value={sourceContent}
            onChange={(event) => setSourceContent(event.target.value)}
            placeholder="Describe qué necesitas de Preventa. El texto se conserva tal cual."
          />
          <p className="mt-1 text-xs text-muted">
            Preventa lo verá sin modificaciones y quedará visible junto a cada
            respuesta.
          </p>
        </div>

        {error ? (
          <p className="rounded border border-danger px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={ghostButtonClass}
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => void submit()}
            disabled={!puedeEnviar}
          >
            {saving ? 'Enviando…' : 'Enviar a Preventa'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
