import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { useAuth } from '../../auth/hooks/useAuth';
import { ApiError } from '../../auth/types';
import { fetchOuv, type Ouv } from '../../discovery/api/ouvs-api';
import {
  applyWonSale,
  fetchWonSale,
  saveWonSale,
} from '../../offer-closing/api/won-sale-api';
import { createVentaFromOuvApi } from '../../shared/project/mock-data';
import type {
  CsatSemanaEntry,
  VentaGanadaRecord,
} from '../../shared/project/types';
import {
  fetchHistorialEstados,
  fetchProyectoEjecucion,
  type HistorialEstados as Historial,
  type ProyectoEjecucion,
} from '../api/projects-api';
import { CrearProyectoPmoModal } from '../components/CrearProyectoPmoModal';
import { HistorialEstados } from '../components/HistorialEstados';
import { ImplementationNav } from '../components/ImplementationNav';
import { IndicadoresEjecucion } from '../components/IndicadoresEjecucion';
import { ProjectCsatWeeklyPanel } from '../components/ProjectCsatWeeklyPanel';
import { ProjectInfoPanel } from '../components/ProjectInfoPanel';
import { cardClass, primaryButtonClass } from '../components/ui';

/**
 * `PMO_PROJECT_NOT_FOUND` no es un error: significa que la OUV está ganada pero
 * su proyecto todavía no se abrió en el PMO. Es el estado que habilita el alta.
 */
const SIN_PROYECTO = 'PMO_PROJECT_NOT_FOUND';

function esSinProyecto(error: unknown): boolean {
  return error instanceof ApiError && error.code === SIN_PROYECTO;
}

function mensajeDeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

type ProjectTab = 'informacion' | 'csat';

const tabClass = (active: boolean) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    active
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

/** Quién diligencia el CSAT semanal (criterio de Design_JD). */
const ROLES_CSAT = new Set(['Admin', 'DirectorMercadeo', 'SoporteComercial']);

export function ProjectExecutionPage() {
  const { ouvId = '' } = useParams();
  const { user } = useAuth();

  const [ouv, setOuv] = useState<Ouv | null>(null);
  const [ejecucion, setEjecucion] = useState<ProyectoEjecucion | null>(null);
  const [historial, setHistorial] = useState<Historial | null>(null);
  const [record, setRecord] = useState<VentaGanadaRecord | null>(null);
  const [sinProyecto, setSinProyecto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csatError, setCsatError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCrear, setShowCrear] = useState(false);
  const [tab, setTab] = useState<ProjectTab>('informacion');

  const vendedorNombre = user?.full_name ?? 'Comercial';

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let ouvCargada: Ouv;
    try {
      ouvCargada = await fetchOuv(ouvId);
      setOuv(ouvCargada);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo cargar la oportunidad.'));
      setIsLoading(false);
      return;
    }

    // El proyecto del PMO se consulta aparte: que no exista todavía no impide
    // mostrar la OUV, y los bloques fallan de forma independiente. El
    // expediente de la venta ganada aporta fechas, empresas, SER y CSAT.
    const [ejecucionResult, historialResult, expedienteResult] =
      await Promise.allSettled([
        fetchProyectoEjecucion(ouvId),
        fetchHistorialEstados(ouvId),
        fetchWonSale(ouvId),
      ]);

    if (ejecucionResult.status === 'fulfilled') {
      setEjecucion(ejecucionResult.value);
      setSinProyecto(false);
    } else if (esSinProyecto(ejecucionResult.reason)) {
      setEjecucion(null);
      setSinProyecto(true);
    } else {
      setEjecucion(null);
      setError(
        mensajeDeError(
          ejecucionResult.reason,
          'No se pudieron leer los indicadores del PMO.',
        ),
      );
    }

    setHistorial(
      historialResult.status === 'fulfilled' ? historialResult.value : null,
    );

    const expediente =
      expedienteResult.status === 'fulfilled' ? expedienteResult.value : null;
    setRecord(
      expediente
        ? applyWonSale(
            createVentaFromOuvApi(ouvCargada, vendedorNombre),
            expediente,
          )
        : null,
    );

    setIsLoading(false);
  }, [ouvId, vendedorNombre]);

  useEffect(() => {
    void load();
  }, [load]);

  const puedeCrear = sinProyecto && ouv?.resultado === 'Ganada';
  const canEditCsat = Boolean(
    record && user?.role_name && ROLES_CSAT.has(user.role_name),
  );

  /** Una medición por semana ISO: si la semana ya existe, se reemplaza. */
  async function saveWeeklyCsat(entry: CsatSemanaEntry) {
    if (!record) return;
    setCsatError(null);
    const next: VentaGanadaRecord = {
      ...record,
      csat: {
        ...record.csat,
        valor: entry.valor,
        fecha: entry.registradoEn,
        semanas: [
          entry,
          ...(record.csat.semanas ?? []).filter(
            (row) => row.semanaIso !== entry.semanaIso,
          ),
        ],
      },
    };
    try {
      setRecord(applyWonSale(next, await saveWonSale(next)));
    } catch (err) {
      setCsatError(mensajeDeError(err, 'No se pudo guardar el CSAT.'));
    }
  }

  return (
    <AppLayout title="Proyecto en ejecución">
      <ImplementationNav />

      {isLoading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted">
                {record?.envioPmo.serConsecutivo
                  ? `${record.envioPmo.serConsecutivo} · `
                  : ''}
                Control de Proyectos (PMO)
              </p>
              <h1 className="text-xl font-bold text-ink">
                {ouv?.titulo ?? '—'}
              </h1>
              <p className="text-sm text-muted">
                OUV origen:{' '}
                <Link
                  to={`/opportunities/${ouvId}`}
                  className="text-accent hover:underline"
                >
                  {ouv?.consecutivo ?? ouvId}
                </Link>
                {ejecucion ? ` · Proyecto PMO #${ejecucion.projectId}` : ''}
              </p>
            </div>

            {puedeCrear ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => setShowCrear(true)}
              >
                Crear proyecto en el PMO
              </button>
            ) : null}
          </header>

          {error ? (
            <p className="rounded bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

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
            <>
              {sinProyecto ? (
                <section className={cardClass}>
                  <h2 className="text-sm font-bold text-ink">
                    Sin proyecto en el PMO
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {ouv?.resultado === 'Ganada'
                      ? 'Esta oportunidad todavía no tiene un proyecto abierto en Control de Proyectos.'
                      : 'Sólo una OUV ganada puede abrir su proyecto en Control de Proyectos.'}
                  </p>
                </section>
              ) : null}

              <ProjectInfoPanel
                ouv={ouv}
                ejecucion={ejecucion}
                record={record}
                historial={historial?.history ?? null}
              />

              {ejecucion ? <IndicadoresEjecucion proyecto={ejecucion} /> : null}

              {historial ? (
                <HistorialEstados transiciones={historial.history} />
              ) : null}
            </>
          ) : record ? (
            <>
              {csatError ? (
                <p className="rounded bg-danger/10 px-3 py-2 text-sm text-danger">
                  {csatError}
                </p>
              ) : null}
              <ProjectCsatWeeklyPanel
                record={record}
                canEdit={canEditCsat}
                onSave={(entry) => void saveWeeklyCsat(entry)}
              />
            </>
          ) : (
            <section className={cardClass}>
              <p className="text-sm text-muted">
                Esta OUV no tiene expediente de venta ganada: el CSAT se
                registra una vez diligenciado en Oferta &amp; Cierre.
              </p>
            </section>
          )}
        </div>
      )}

      {showCrear && ouv ? (
        <CrearProyectoPmoModal
          ouvId={ouvId}
          nombreSugerido={ouv.titulo}
          onClose={() => setShowCrear(false)}
          onCreated={() => {
            setShowCrear(false);
            void load();
          }}
        />
      ) : null}
    </AppLayout>
  );
}
