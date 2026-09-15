import { useState } from 'react';
import { Expand } from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  isDirectorMercadeoRole,
  isEjecutivoComercialRole,
  isSoporteComercialRole,
} from '../../auth/lib/permission-catalog';
import type { CsatSemanaEntry, VentaGanadaRecord } from '../../shared/project/types';
import { upsertVentaGanada } from '../../shared/project/mock-store';
import { FormularioDatosProyecto } from '../../offer-closing/components/FormularioDatosProyecto';
import { ProjectCsatWeeklyPanel } from './ProjectCsatWeeklyPanel';
import { ProjectInfoPanel } from './ProjectInfoPanel';
import { ghostButtonClass, primaryButtonClass } from './ui';

type Props = {
  record: VentaGanadaRecord;
  onUpdate?: (r: VentaGanadaRecord) => void;
};

type ProjectTab = 'informacion' | 'csat';

const tabClass = (active: boolean) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    active
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

/** Detalle SER: ficha de proyecto + CSAT semanal. */
export function ProjectDashboard({ record, onUpdate }: Props) {
  const { user } = useAuth();
  const [showAmpliar, setShowAmpliar] = useState(false);
  const [tab, setTab] = useState<ProjectTab>('informacion');
  const canEditCsat =
    user?.role_name === 'Admin' ||
    isDirectorMercadeoRole(user?.role_name) ||
    (user?.permissions?.some(
      (rule) => rule.action === 'update' && rule.subject === 'Csat',
    ) ??
      false);
  const canAmpliar =
    !isDirectorMercadeoRole(user?.role_name) &&
    !isSoporteComercialRole(user?.role_name) &&
    !isEjecutivoComercialRole(user?.role_name);

  function saveWeeklyCsat(entry: CsatSemanaEntry) {
    const prev = record.csat.semanas ?? [];
    const semanas = [
      entry,
      ...prev.filter((row) => row.semanaIso !== entry.semanaIso),
    ];
    const next = upsertVentaGanada({
      ...record,
      csat: {
        ...record.csat,
        valor: entry.valor,
        fecha: entry.registradoEn,
        semanas,
      },
    });
    onUpdate?.(next);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">{record.consecutivo}</h1>
        {canAmpliar ? (
          <button
            type="button"
            className={`${ghostButtonClass} inline-flex items-center gap-2`}
            onClick={() => setShowAmpliar(true)}
          >
            <Expand size={16} aria-hidden />
            Ampliar proyecto
          </button>
        ) : null}
      </header>

      <nav
        className="flex flex-wrap gap-1 border-b border-border"
        aria-label="Proyecto"
      >
        <button
          type="button"
          className={tabClass(tab === 'informacion')}
          onClick={() => setTab('informacion')}
          aria-current={tab === 'informacion' ? 'page' : undefined}
        >
          Información proyecto
        </button>
        <button
          type="button"
          className={tabClass(tab === 'csat')}
          onClick={() => setTab('csat')}
          aria-current={tab === 'csat' ? 'page' : undefined}
        >
          CSAT
        </button>
      </nav>

      {tab === 'informacion' ? (
        <ProjectInfoPanel record={record} />
      ) : (
        <ProjectCsatWeeklyPanel
          record={record}
          canEdit={canEditCsat}
          onSave={saveWeeklyCsat}
        />
      )}

      {showAmpliar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded bg-surface p-6">
            <h2 className="mb-4 text-lg font-bold">Ampliar proyecto</h2>
            <FormularioDatosProyecto
              datos={record.datosBase}
              modo="ampliar"
              onChange={(datosBase) => {
                const next = upsertVentaGanada({ ...record, datosBase });
                onUpdate?.(next);
              }}
            />
            <button
              type="button"
              className={`${primaryButtonClass} mt-4`}
              onClick={() => setShowAmpliar(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
