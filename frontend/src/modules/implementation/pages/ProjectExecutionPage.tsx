import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../../layout/AppLayout';
import { ApiError } from '../../auth/types';
import { fetchOuv, type Ouv } from '../../discovery/api/ouvs-api';
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

export function ProjectExecutionPage() {
  const { ouvId = '' } = useParams();

  const [ouv, setOuv] = useState<Ouv | null>(null);
  const [ejecucion, setEjecucion] = useState<ProyectoEjecucion | null>(null);
  const [historial, setHistorial] = useState<Historial | null>(null);
  const [sinProyecto, setSinProyecto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCrear, setShowCrear] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setOuv(await fetchOuv(ouvId));
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo cargar la oportunidad.'));
      setIsLoading(false);
      return;
    }

    // El proyecto del PMO se consulta aparte: que no exista todavía no impide
    // mostrar la OUV, y los dos bloques fallan de forma independiente.
    const [ejecucionResult, historialResult] = await Promise.allSettled([
      fetchProyectoEjecucion(ouvId),
      fetchHistorialEstados(ouvId),
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
    setIsLoading(false);
  }, [ouvId]);

  useEffect(() => {
    void load();
  }, [load]);

  const puedeCrear = sinProyecto && ouv?.resultado === 'Ganada';

  return (
    <AppLayout title="Proyecto en ejecución">
      <ImplementationNav />

      {isLoading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Control de Proyectos (PMO)</p>
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

          {ejecucion ? <IndicadoresEjecucion proyecto={ejecucion} /> : null}

          {historial ? (
            <HistorialEstados transiciones={historial.history} />
          ) : null}
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
