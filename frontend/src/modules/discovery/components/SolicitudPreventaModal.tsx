import { Clock3, Layers, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Ouv } from '../api/ouvs-api';
import {
  ACTIVITY_PRIORITY_OPTIONS,
  SERVICE_COMBOS,
  SOLICITUD_PREVENTA_FIELDS,
  buildServiceCards,
  mockInteractionRef,
  type ActivityPriority,
  type ServiceCard,
  type ServiceComboId,
} from '../lib/opportunity-context-fields';
import { ModalShell } from './ModalShell';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

export type SolicitudPreventaRecord = {
  id: string;
  priority: ActivityPriority;
  tipoId: ServiceComboId;
  tipoNombre: string;
  subject: string;
  status: 'ENVIADA' | 'FALLIDA';
  /** Estado retornado por MEP (diferenciador visual en detalle). */
  mepStatus: MepSolicitudStatus;
  interactionRef: string;
  sourceVersion: string;
  etag: string;
  services: ServiceCard[];
  /** Ambos servicios en un mismo contenedor (Técnico y financiero). */
  sameContainer: boolean;
  values: Record<string, string>;
  requestedServices: { service: string; dependency: string }[];
  createdAt: string;
};

export type MepSolicitudStatus = 'Aceptado' | 'Aprobado' | 'Rechazado' | 'Pendiente';

const MEP_MOCK_STATUSES: MepSolicitudStatus[] = [
  'Aceptado',
  'Aprobado',
  'Rechazado',
  'Pendiente',
];

type Props = {
  ouv: Ouv;
  commercialOwnerName?: string;
  onClose: () => void;
  onResult: (result: {
    ok: boolean;
    message: string;
    record?: SolicitudPreventaRecord;
  }) => void;
};

type FormValues = Record<string, string>;
type Step = 1 | 2 | 3;

const PRIORITY_ICONS: Record<ActivityPriority, LucideIcon> = {
  ASAP: Clock3,
  SOMBRA: Layers,
};

function buildValues(
  ouv: Ouv,
  priority: ActivityPriority | null,
): FormValues {
  const meta = ACTIVITY_PRIORITY_OPTIONS.find((o) => o.id === priority);
  const interactionRef = mockInteractionRef(`${ouv.ouv_id}:${Date.now()}`);
  const version = '1';
  return {
    crm_interaction_ref: interactionRef,
    crm_opportunity_ref: ouv.ouv_id,
    activity_type: meta?.activityType ?? '',
    service_horizon: meta?.horizon ?? '',
    subject: '',
    source_content: '',
    source_created_at: new Date().toISOString().slice(0, 16),
    source_version: version,
    // MEP envía la fecha de respuesta cuando esté en roadmap; CRM no la edita.
    etag: '',
  };
}

/** Modal por fases: prioridad → tipo → campos → envío. */
export function SolicitudPreventaModal({
  ouv,
  onClose,
  onResult,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [priority, setPriority] = useState<ActivityPriority | null>(null);
  const [comboId, setComboId] = useState<ServiceComboId | ''>('');
  const [values, setValues] = useState<FormValues>(() => buildValues(ouv, null));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setStep(1);
    setPriority(null);
    setComboId('');
    setValues(buildValues(ouv, null));
    setSending(false);
  }, [ouv.ouv_id]);

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
    await new Promise((r) => setTimeout(r, 900));
    const ok = Math.random() > 0.15;
    if (ok) {
      const services = buildServiceCards(combo.id);
      const record: SolicitudPreventaRecord = {
        id: `sol-${Date.now()}`,
        priority,
        tipoId: combo.id,
        tipoNombre: combo.name,
        subject: values.subject || '(Sin asunto)',
        status: 'ENVIADA',
        mepStatus:
          MEP_MOCK_STATUSES[
            Math.floor(Math.random() * MEP_MOCK_STATUSES.length)
          ]!,
        interactionRef: values.crm_interaction_ref,
        sourceVersion: values.source_version,
        etag: values.etag,
        services,
        sameContainer: combo.id === 'technical_and_financial',
        values: { ...values },
        requestedServices: combo.services.map((s) => ({ ...s })),
        createdAt: new Date().toISOString(),
      };
      onResult({
        ok: true,
        message: 'Envío exitoso a Preventa. La solicitud fue recibida por MEP.',
        record,
      });
    } else {
      onResult({
        ok: false,
        message:
          'Envío fallido. Preventa no pudo recibir la solicitud. Intenta de nuevo.',
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
            autoFocus
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
                  <label className={labelClass} htmlFor={`modal-sol-${field.key}`}>
                    {field.label}
                    {locked && field.key !== 'etag' ? (
                      <span className="ml-1 font-normal text-muted">(fijo)</span>
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
