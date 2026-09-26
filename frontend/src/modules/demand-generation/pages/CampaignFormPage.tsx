import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { useAuth } from '../../auth/hooks/useAuth';
import { createCampaign } from '../api/campaigns-api';
import { enqueueLeadImport } from '../api/leads-api';
import { CampaignLeadImportCard } from '../components/CampaignLeadImportCard';
import { DemandNav } from '../components/DemandNav';
import { LeadImportDuplicateReview } from '../components/leads/LeadImportDuplicateReview';
import { ModalShell } from '../components/ModalShell';
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';
import {
  assertCampaignFileMatchesSegmento,
  assertRepeatedCompaniesInLeadCsv,
  fileToLeadImportCsv,
} from '../lib/lead-bulk-import';
import {
  duplicateImportRows,
  importRowKey,
  pollLeadImportJob,
} from '../lib/lead-import-job';
import {
  CAMPAIGN_OBJETIVO_LABEL,
  CAMPAIGN_OBJETIVOS,
  SEGMENTOS_OBJETIVO,
  type BulkImportJobStatus,
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
  const [reviewStatus, setReviewStatus] = useState<BulkImportJobStatus | null>(
    null,
  );
  const [authorizedKeys, setAuthorizedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [confirmingDuplicates, setConfirmingDuplicates] = useState(false);
  const csvFileRef = useRef<File | null>(null);
  const campaignIdRef = useRef<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function runCampaignImport(
    csvFile: File,
    campanaId: string,
    expectedSegmento: SegmentoObjetivo,
    authorizedDuplicates?: Array<{ row: number; email: string }>,
  ): Promise<BulkImportJobStatus> {
    const accepted = await enqueueLeadImport(csvFile, {
      campanaId,
      expectedSegmento,
      canalOrigen: 'GENERACION_DEMANDA_AGENCIA',
      authorizedDuplicates,
    });
    return pollLeadImportJob(accepted.job_id);
  }

  function toggleAuthorized(key: string) {
    setAuthorizedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleAllAuthorized(keys: string[]) {
    setAuthorizedKeys((prev) => {
      const allSelected = keys.every((key) => prev.has(key));
      return allSelected ? new Set() : new Set(keys);
    });
  }

  async function handleConfirmAuthorizedDuplicates() {
    const csvFile = csvFileRef.current;
    const campanaId = campaignIdRef.current;
    const current = reviewStatus;
    if (!csvFile || !campanaId || !current) return;
    const authorizedDuplicates = duplicateImportRows(current)
      .filter((row) => authorizedKeys.has(importRowKey(row.row, row.email)))
      .map((row) => ({ row: row.row, email: row.email }));
    if (authorizedDuplicates.length === 0) {
      navigate('/demand/campaigns');
      return;
    }
    setConfirmingDuplicates(true);
    setError(null);
    try {
      const status = await runCampaignImport(
        csvFile,
        campanaId,
        form.segmento_objetivo,
        authorizedDuplicates,
      );
      if (status.status === 'failed') {
        throw new Error(
          status.error ??
            'La campaña se creó, pero no se pudieron crear los leads autorizados.',
        );
      }
      navigate('/demand/campaigns');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudieron crear los leads autorizados.',
      );
    } finally {
      setConfirmingDuplicates(false);
    }
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
      assertRepeatedCompaniesInLeadCsv(csv);
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
      csvFileRef.current = csvFile;
      campaignIdRef.current = campaign.campana_id;
      const status = await runCampaignImport(
        csvFile,
        campaign.campana_id,
        form.segmento_objetivo,
      );
      if (status.status === 'failed') {
        throw new Error(
          status.error ??
            'La campaña se creó, pero la importación falló. Revisa el archivo y vuelve a cargar desde leads.',
        );
      }
      if (duplicateImportRows(status).length > 0) {
        setReviewStatus(status);
        setAuthorizedKeys(new Set());
        return;
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

          {error ? (
            <p className="whitespace-pre-line text-sm text-danger">{error}</p>
          ) : null}

          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting ? 'Creando campaña…' : 'Crear campaña'}
          </button>
        </div>

        <CampaignLeadImportCard file={file} onFileChange={setFile} />
      </form>

      {reviewStatus ? (
        <ModalShell
          title="Duplicados en el cargue"
          size="wide"
          onClose={() => navigate('/demand/campaigns')}
        >
          <LeadImportDuplicateReview
            status={reviewStatus}
            authorizedKeys={authorizedKeys}
            confirming={confirmingDuplicates}
            error={error}
            declineLabel="Continuar sin duplicados"
            onToggle={toggleAuthorized}
            onToggleAll={toggleAllAuthorized}
            onDecline={() => navigate('/demand/campaigns')}
            onConfirm={() => void handleConfirmAuthorizedDuplicates()}
          />
        </ModalShell>
      ) : null}
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
