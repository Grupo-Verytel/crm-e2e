import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { useAuth } from '../../auth/hooks/useAuth';
import { createCampaign } from '../api/campaigns-api';
import { enqueueLeadImport, fetchImportStatus } from '../api/leads-api';
import { CampaignLeadImportCard } from '../components/CampaignLeadImportCard';
import { DemandNav } from '../components/DemandNav';
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';
import {
  assertCampaignFileMatchesSegmento,
  fileToLeadImportCsv,
} from '../lib/lead-bulk-import';
import {
  CAMPAIGN_OBJETIVO_LABEL,
  CAMPAIGN_OBJETIVOS,
  SEGMENTOS_OBJETIVO,
  type CampaignObjetivo,
  type CreateCampaignPayload,
  type SegmentoObjetivo,
} from '../types';

type FormState = {
  nombre: string;
  objetivo: CampaignObjetivo;
  segmento_objetivo: SegmentoObjetivo;
  fecha_inicio: string;
  fecha_fin: string;
  presupuesto: string;
  gasto_real: string;
};

const initialState: FormState = {
  nombre: '',
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
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function pollUntilDone(jobId: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const current = await fetchImportStatus(jobId);
      if (current.status === 'completed' || current.status === 'failed') {
        return current;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new Error('La importación sigue en proceso. Revisa los leads en unos minutos.');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    if (!file) {
      setError('Selecciona el archivo CSV o Excel con los leads de la campaña.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const csv = await fileToLeadImportCsv(file);
      assertCampaignFileMatchesSegmento(csv, form.segmento_objetivo);

      const payload: CreateCampaignPayload = {
        nombre: form.nombre,
        canal: 'GENERACION_DEMANDA_AGENCIA',
        objetivo: form.objetivo,
        segmento_objetivo: form.segmento_objetivo,
        responsable_id: user.user_id,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        ...(form.presupuesto ? { presupuesto: Number(form.presupuesto) } : {}),
        ...(form.gasto_real ? { gasto_real: Number(form.gasto_real) } : {}),
      };

      const campaign = await createCampaign(payload);
      const csvFile = new File(
        [csv],
        file.name.replace(/\.(xls|xlsx)$/i, '.csv'),
        { type: 'text/csv' },
      );
      const accepted = await enqueueLeadImport(csvFile, {
        campanaId: campaign.campana_id,
        expectedSegmento: form.segmento_objetivo,
        canalOrigen: 'GENERACION_DEMANDA_AGENCIA',
      });
      const status = await pollUntilDone(accepted.job_id);
      if (status.status === 'failed') {
        throw new Error(
          status.error ??
            'La campaña se creó, pero la importación falló. Revisa el archivo y vuelve a cargar desde leads.',
        );
      }
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

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
        <div className={`${cardClass} space-y-3 p-5`}>
          <h2 className="text-sm font-bold text-ink">Datos de la campaña</h2>

          <Field label="Nombre de la campaña">
            <input
              value={form.nombre}
              onChange={(event) => update('nombre', event.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
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
                    {CAMPAIGN_OBJETIVO_LABEL[objetivo]}
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
            {isSubmitting ? 'Creando campaña…' : 'Crear campaña'}
          </button>
        </div>

        <CampaignLeadImportCard file={file} onFileChange={setFile} />
      </form>
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
