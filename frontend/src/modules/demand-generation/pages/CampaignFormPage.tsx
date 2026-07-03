import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { useAuth } from '../../auth/hooks/useAuth';
import { createCampaign } from '../api/campaigns-api';
import { CsvImportStepper } from '../components/CsvImportStepper';
import { DemandNav } from '../components/DemandNav';
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';
import {
  CAMPAIGN_OBJETIVOS,
  CAMPAIGN_TIPOS,
  SEGMENTOS_OBJETIVO,
  type CampaignObjetivo,
  type CampaignTipo,
  type CreateCampaignPayload,
  type SegmentoObjetivo,
} from '../types';

type FormState = {
  nombre: string;
  tipo: CampaignTipo;
  canal: string;
  objetivo: CampaignObjetivo;
  segmento_objetivo: SegmentoObjetivo;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto: string;
  gasto_real: string;
};

const initialState: FormState = {
  nombre: '',
  tipo: 'Email',
  canal: '',
  objetivo: 'LeadGen',
  segmento_objetivo: 'Todos',
  fecha_inicio: '',
  fecha_fin: '',
  presupuesto: '',
  gasto_real: '',
};

export function CampaignFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setError(null);

    const payload: CreateCampaignPayload = {
      nombre: form.nombre,
      tipo: form.tipo,
      canal: form.canal,
      objetivo: form.objetivo,
      segmento_objetivo: form.segmento_objetivo,
      responsable_id: user.user_id,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      ...(form.presupuesto ? { presupuesto: Number(form.presupuesto) } : {}),
      ...(form.gasto_real ? { gasto_real: Number(form.gasto_real) } : {}),
    };

    try {
      await createCampaign(payload);
      navigate('/demand/campaigns');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo crear la campaña.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout title="Nueva campaña">
      <DemandNav />

      <Link
        to="/demand/campaigns"
        className="mb-3 inline-block text-sm text-muted hover:text-ink"
      >
        ← Volver a campañas
      </Link>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className={`${cardClass} space-y-3 p-5`}>
          <h2 className="text-sm font-bold text-ink">Datos de la campaña</h2>

          <Field label="Nombre">
            <input
              value={form.nombre}
              onChange={(event) => update('nombre', event.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select
                value={form.tipo}
                onChange={(event) => update('tipo', event.target.value as CampaignTipo)}
                className={inputClass}
              >
                {CAMPAIGN_TIPOS.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Canal">
              <input
                value={form.canal}
                onChange={(event) => update('canal', event.target.value)}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Objetivo">
              <select
                value={form.objetivo}
                onChange={(event) =>
                  update('objetivo', event.target.value as CampaignObjetivo)
                }
                className={inputClass}
              >
                {CAMPAIGN_OBJETIVOS.map((objetivo) => (
                  <option key={objetivo} value={objetivo}>
                    {objetivo}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Segmento objetivo">
              <select
                value={form.segmento_objetivo}
                onChange={(event) =>
                  update('segmento_objetivo', event.target.value as SegmentoObjetivo)
                }
                className={inputClass}
              >
                {SEGMENTOS_OBJETIVO.map((segmento) => (
                  <option key={segmento} value={segmento}>
                    {segmento}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha inicio">
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={(event) => update('fecha_inicio', event.target.value)}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Fecha fin">
              <input
                type="date"
                value={form.fecha_fin}
                onChange={(event) => update('fecha_fin', event.target.value)}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Presupuesto">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.presupuesto}
                onChange={(event) => update('presupuesto', event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Gasto real">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.gasto_real}
                onChange={(event) => update('gasto_real', event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            Crear campaña
          </button>
        </form>

        <CsvImportStepper />
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      {children}
    </div>
  );
}
