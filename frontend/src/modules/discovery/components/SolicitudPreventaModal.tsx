import { Clock3, Layers, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../auth/types';
import type { Ouv } from '../api/ouvs-api';
import {
  crearSolicitudPreventa,
  type SolicitudPreventa,
} from '../api/solicitudes-preventa-api';
import {
  ACTIVITY_PRIORITY_OPTIONS,
  SERVICE_COMBOS,
  SOLICITUD_PREVENTA_FIELDS,
  type ActivityPriority,
  type ServiceComboId,
} from '../lib/opportunity-context-fields';
import { ModalShell } from './ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  ouv: Ouv;
  commercialOwnerName?: string;
  onClose: () => void;
  onResult: (result: {
    ok: boolean;
    message: string;
    record?: SolicitudPreventa;
  }) => void;
};

type FormValues = Record<string, string>;
type Step = 1 | 2 | 3;

const PRIORITY_ICONS: Record<ActivityPriority, LucideIcon> = {
  ASAP: Clock3,
  SOMBRA: Layers,
};

/**
 * Valores del formulario.
 *
 * `crm_interaction_ref`, `source_version` y `etag` son autoridad del CRM (§4,
 * P-01): se muestran vacíos y de solo lectura hasta que el backend los asigna
 * al crear la solicitud. El diseño los derivaba en el browser con
 * `mockInteractionRef()`, lo que rompería la identidad de correlación del
 * contrato.
 */
function buildValues(ouv: Ouv, priority: ActivityPriority | null): FormValues {
  const meta = ACTIVITY_PRIORITY_OPTIONS.find((o) => o.id === priority);
  return {
    crm_interaction_ref: '',
    crm_opportunity_ref: ouv.consecutivo,
    activity_type: meta?.activityType ?? '',
    service_horizon: meta?.horizon ?? '',
    subject: '',
    source_content: '',
    source_created_at: new Date().toISOString().slice(0, 16),
    source_version: '',
    etag: '',
  };
}

/** Modal por fases: prioridad → tipo → campos → envío. */
export function SolicitudPreventaModal({ ouv, onClose, onResult }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [priority, setPriority] = useState<ActivityPriority | null>(null);
  const [comboId, setComboId] = useState<ServiceComboId | ''>('');
  const [values, setValues] = useState<FormValues>(() => buildValues(ouv, null));
  const [sending, setSending] = useState(false);

  // Reset al cambiar de OUV. Se hace en render, no en un efecto: React
  // recomienda este patrón para derivar estado de un prop y evita el
  // re-render en cascada que provoca `setState` dentro de `useEffect`.
  const [ouvCargada, setOuvCargada] = useState(ouv.ouv_id);
  if (ouvCargada !== ouv.ouv_id) {
    setOuvCargada(ouv.ouv_id);
    setStep(1);
    setPriority(null);
    setComboId('');
    setValues(buildValues(ouv, null));
    setSending(false);
  }

  const combo = SERVICE_COMBOS.find((c) => c.id === comboId) ?? null;

  function patch(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function selectPriority(id: ActivityPriority) {
    setPriority(id);
    const meta = ACTIVITY_PRIORITY_OPTIONS.find((o) => o.id === id);
    setValues((prev) => ({
      ...prev,
      activity_type: meta?.activityType ?? '',
      service_horizon: meta?.horizon ?? '',
    }));
  }

  async function handleSend() {
    if (!priority || !combo) return;
    setSending(true);

    try {
      const record = await crearSolicitudPreventa(ouv.ouv_id, {
        priority,
        service_combo: combo.id,
        subject: values.subject || undefined,
        // Sin trim: el contenido original se preserva sin alteración (P-07).
        source_content: values.source_content,
      });
      onResult({
        ok: true,
        message: 'Envío exitoso a Preventa. La solicitud fue recibida por MEP.',
        record,
      });
    } catch (err) {
      onResult({
        ok: false,
        message:
          err instanceof ApiError
            ? err.message
            : 'Envío fallido. Preventa no pudo recibir la solicitud. Intenta de nuevo.',
      });
      setSending(false);
    }
  }

  return (
    <ModalShell
      title="Nueva solicitud Preventa"
      onClose={onClose}
      size={step === 3 ? 'wide' : 'compact'}
    >
      <ol className="mb-5 flex flex-wrap gap-2 text-xs font-bold">
        {(
          [
            { n: 1, label: 'Prioridad' },
            { n: 2, label: 'Tipo de actividad' },
            { n: 3, label: 'Datos de envío' },
          ] as const
        ).map((s) => (
          <li
            key={s.n}
            className={[
              'rounded px-2.5 py-1',
              step === s.n
                ? 'bg-accent text-white'
                : step > s.n
                  ? 'bg-border text-muted'
                  : 'bg-bg text-muted',
            ].join(' ')}
          >
            {s.n}. {s.label}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div>
          <p className="mb-3 text-sm text-muted">
            Primero elige la prioridad de la solicitud.
          </p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_PRIORITY_OPTIONS.map((option) => {
              const isActive = priority === option.id;
              const Icon = PRIORITY_ICONS[option.id];
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectPriority(option.id)}
                  className={[
                    'inline-flex h-10 items-center gap-2 rounded px-4 text-sm font-bold transition-colors',
                    isActive ? 'btn-glow text-white' : 'btn-glow-outline',
                  ].join(' ')}
                  aria-pressed={isActive}
                >
                  <Icon size={16} strokeWidth={2} aria-hidden />
                  {option.name}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={ghostButtonClass} onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={!priority}
              onClick={() => setStep(2)}
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <p className="mb-3 text-sm text-muted">
            Prioridad:{' '}
            <span className="font-bold text-ink">
              {priority === 'ASAP' ? 'ASAP' : 'Sombra'}
            </span>
            . Ahora elige el tipo de actividad.
          </p>
          <label className={labelClass} htmlFor="modal-solicitud-tipo">
            Tipo de actividad
          </label>
          <select
            id="modal-solicitud-tipo"
            className={`${inputClass} max-w-md`}
            value={comboId}
            onChange={(e) => setComboId(e.target.value as ServiceComboId | '')}
          >
            <option value="">Seleccionar…</option>
            {SERVICE_COMBOS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="mt-6 flex justify-between gap-2">
            <button
              type="button"
              className={ghostButtonClass}
              onClick={() => setStep(1)}
            >
              Atrás
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={!comboId}
              onClick={() => setStep(3)}
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <p className="mb-3 text-sm text-muted">
            Revisa y completa los campos de la solicitud antes de enviar.
          </p>
          <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded bg-accent/15 px-2 py-0.5 text-accent">
              {priority === 'ASAP' ? 'ASAP' : 'Sombra'}
            </span>
            <span className="rounded bg-border px-2 py-0.5 text-ink">
              {combo?.name}
            </span>
          </div>

          {combo ? (
            <div className="mb-4 rounded border border-border bg-bg p-3">
              <p className={`${labelClass} mb-2`}>Servicios solicitados</p>
              <ul className="space-y-1 text-sm text-ink">
                {combo.services.map((svc) => (
                  <li key={svc.service}>
                    <span className="font-bold">{svc.service}</span>
                    <span className="text-muted">
                      {' '}
                      · dependencia: {svc.dependency}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {SOLICITUD_PREVENTA_FIELDS.map((field) => {
              const locked = Boolean(field.locked);
              const isTextarea = field.inputType === 'textarea';
              return (
                <div
                  key={field.key}
                  className={field.spanFull ? 'sm:col-span-2' : undefined}
                >
                  <label
                    className={labelClass}
                    htmlFor={`modal-sol-${field.key}`}
                  >
                    {field.label}
                    {locked ? (
                      <span className="ml-1 font-normal text-muted">
                        {values[field.key] ? '(fijo)' : '(lo asigna el CRM)'}
                      </span>
                    ) : null}
                  </label>
                  {isTextarea ? (
                    <textarea
                      id={`modal-sol-${field.key}`}
                      className={`${inputClass} h-20 py-2`}
                      value={values[field.key] ?? ''}
                      readOnly={locked}
                      disabled={locked}
                      onChange={(e) => {
                        if (!locked) patch(field.key, e.target.value);
                      }}
                    />
                  ) : (
                    <input
                      id={`modal-sol-${field.key}`}
                      type={field.inputType ?? 'text'}
                      className={inputClass}
                      value={values[field.key] ?? ''}
                      readOnly={locked}
                      disabled={locked}
                      onChange={(e) => {
                        if (!locked) patch(field.key, e.target.value);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-between gap-2">
            <button
              type="button"
              className={ghostButtonClass}
              disabled={sending}
              onClick={() => setStep(2)}
            >
              Atrás
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={sending || !priority || !combo}
              onClick={() => void handleSend()}
            >
              {sending ? 'Enviando…' : 'Enviar a Preventa'}
            </button>
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}
