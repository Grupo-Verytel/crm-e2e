import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { AppLayout } from '../../../layout/AppLayout';
import { useAuth } from '../../auth/hooks/useAuth';
import { ApiError } from '../../auth/types';
import { fetchOuv, type Ouv } from '../../discovery/api/ouvs-api';
import { OuvReadonlyHeaderCard } from '../../discovery/components/OuvReadonlyHeaderCard';
import { loadOuvExtensions } from '../../discovery/lib/ouv-detail-extensions';
import type { OuvDetailExtensions } from '../../discovery/lib/ouv-detail-extensions';
import { AlertaBanner } from '../../shared/project/AlertaBadge';
import { createVentaFromOuvApi } from '../../shared/project/mock-data';
import {
  getVentaGanada,
  puedeEnviarAPmo,
  puedeEnviarKickoff,
} from '../../shared/project/mock-store';
import type {
  ValidacionTipo,
  VentaGanadaRecord,
} from '../../shared/project/types';
import {
  VALIDACION_ESTADO_LABEL,
  VALIDACION_TIPOS,
} from '../../shared/project/types';
import { deleteKickoff, fetchKickoff, saveKickoff } from '../api/kickoff-api';
import { applyWonSale, fetchWonSale, saveWonSale } from '../api/won-sale-api';
import { FormularioDatosProyecto } from '../components/FormularioDatosProyecto';
import { KickoffCard } from '../components/KickoffCard';
import { ResumenEnvioPmoModal } from '../components/ResumenEnvioPmoModal';
import { SharePointPreviewModal } from '../components/SharePointPreviewModal';
import {
  badgeClass,
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  selectClass,
} from '../components/ui';

type Tab = 'validaciones' | 'kickoff' | 'datos';

function ouvFromVentaRecord(record: VentaGanadaRecord): Ouv {
  const now = new Date().toISOString();
  return {
    ouv_id: record.ouvId,
    consecutivo: record.consecutivo,
    sql_id_origen: null,
    origen_via: 'directa',
    comercial_id: '',
    account_id: null,
    titulo: record.titulo,
    empresa_nombre: record.empresaNombre,
    descripcion: null,
    segmento: 'Gobierno',
    segment_id: null,
    subsegment_id: null,
    vertical: '—',
    zona_actual: 'MAYOR_PROBABILIDAD',
    resultado: 'Ganada',
    tiene_gap: false,
    criterios_faltantes: null,
    presupuesto_confirmado: false,
    presupuesto_monto: null,
    presupuesto_moneda: null,
    presupuesto_fecha_captura: null,
    presupuesto_fuente: null,
    motivo_id: null,
    motivo_snapshot: null,
    motivo_detalle: null,
    competidor_ganador: null,
    monto_final: null,
    moneda_final: null,
    monto_estimado_perdido: null,
    fecha_cierre: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Traduce el fallo del `PUT` a algo que el usuario pueda usar.
 *
 * Un 400 aquí no es culpa de quien llena el formulario: la pantalla ya valida
 * lo que el usuario escribe, así que un rechazo del backend significa que el
 * front está enviando algo que el backend no acepta. Al usuario se le dice qué
 * hacer; el detalle técnico va a la consola, que es donde sirve.
 */
function mensajeDeGuardado(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'No tienes permiso para modificar este expediente.';
    }
    if (error.status === 400 || error.status === 422) {
      console.error('Expediente rechazado por el backend:', error.message);
      return 'No se pudo guardar: el sistema rechazó los datos. Los cambios siguen en pantalla; avisa al equipo técnico.';
    }
    if (error.status >= 500) {
      return 'El servidor no pudo guardar los cambios. Inténtalo de nuevo en un momento.';
    }
    return `No se pudo guardar: ${error.message}`;
  }
  return 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.';
}

/** Detalle de venta ganada — vista de página (mismo patrón que detalle OUV). */
export function VentaGanadaDetailPage() {
  const { ouvId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [record, setRecord] = useState<VentaGanadaRecord | null>(null);
  const [ouv, setOuv] = useState<Ouv | null>(null);
  const [ouvExtensions, setOuvExtensions] = useState<OuvDetailExtensions>({});
  const [tab, setTab] = useState<Tab>('validaciones');
  const [showResumen, setShowResumen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    title: string;
    url: string;
  } | null>(null);

  // El registro base sale de la OUV (consecutivo, cliente, título); lo que se
  // diligencia en pantalla llega del backend, encima de esa base.
  //
  // La OUV se consulta a la API cuando el navegador no la tiene en caché, de
  // modo que el enlace directo a `/offers/:ouvId` funcione igual en un equipo
  // que nunca abrió la bandeja.
  useEffect(() => {
    if (!ouvId) return;
    let cancelled = false;

    async function cargar(): Promise<void> {
      let base = getVentaGanada(ouvId);
      if (!base) {
        // La OUV no trae el nombre del comercial, solo su id; el vendedor se
        // muestra a partir de quien esté en sesión.
        const ouvApi = await fetchOuv(ouvId);
        base = createVentaFromOuvApi(ouvApi, user?.full_name ?? 'Comercial');
      }
      if (cancelled) return;
      setRecord(base);

      const wonSale = await fetchWonSale(ouvId);
      if (cancelled || !wonSale) return;
      setRecord((prev) => (prev ? applyWonSale(prev, wonSale) : prev));
    }

    setLoadError(null);
    void cargar().catch(() => {
      if (cancelled) return;
      setLoadError(
        'No se pudo cargar esta venta. Comprueba que la OUV exista y que tengas permiso para verla.',
      );
    });

    return () => {
      cancelled = true;
    };
  }, [ouvId, user]);

  // El kickoff vive en su propia tabla porque apunta a un evento de Microsoft
  // 365; se carga aparte del resto del expediente.
  useEffect(() => {
    if (!ouvId) return;
    let cancelled = false;
    fetchKickoff(ouvId)
      .then((kickoff) => {
        if (cancelled || !kickoff) return;
        setRecord((prev) => (prev ? { ...prev, kickoff } : prev));
      })
      .catch(() => {
        if (!cancelled) setToast('No se pudo cargar el kickoff.');
      });
    return () => {
      cancelled = true;
    };
  }, [ouvId]);

  useEffect(() => {
    if (!record) {
      setOuv(null);
      return;
    }
    setOuvExtensions(loadOuvExtensions(record.ouvId));
    void fetchOuv(record.ouvId)
      .then(setOuv)
      .catch(() => setOuv(ouvFromVentaRecord(record)));
  }, [record]);

  if (!record) {
    return (
      <AppLayout title="Oferta & Cierre">
        <p className="text-sm text-muted">
          {loadError ?? 'Cargando la venta…'}
        </p>
        <Link
          to="/offers"
          className="mt-3 inline-block text-sm text-accent hover:underline"
        >
          ← Bandeja soporte comercial
        </Link>
      </AppLayout>
    );
  }

  /**
   * Guarda en el backend y deja el resultado en pantalla. El `setRecord`
   * inmediato mantiene el formulario fluido; si el `PUT` falla se avisa y el
   * usuario conserva lo escrito para reintentar.
   */
  function save(next: VentaGanadaRecord) {
    setRecord(next);
    void saveWonSale(next)
      .then((wonSale) => {
        setRecord((prev) => (prev ? applyWonSale(prev, wonSale) : prev));
      })
      .catch((error: unknown) => {
        setToast(mensajeDeGuardado(error));
      });
  }

  /**
   * El kickoff se guarda en el backend, no en el mock-store: sin agenda es un
   * borrado (que además cancela el evento en Microsoft 365).
   */
  async function saveKickoffRecord(next: VentaGanadaRecord['kickoff']) {
    if (!record) return;
    setRecord({ ...record, kickoff: next });
    try {
      if (!next.agenda && !next.agendamientoConfirmado) {
        await deleteKickoff(record.ouvId);
        return;
      }
      const saved = await saveKickoff(record.ouvId, next);
      setRecord((prev) => (prev ? { ...prev, kickoff: saved } : prev));
    } catch (error) {
      setToast(
        error instanceof Error
          ? `No se pudo guardar el kickoff: ${error.message}`
          : 'No se pudo guardar el kickoff.',
      );
    }
  }

  function setValidacion(
    tipo: ValidacionTipo,
    estado: VentaGanadaRecord['validaciones'][ValidacionTipo]['estado'],
    observacion: string,
  ) {
    if (!record) return;
    const next: VentaGanadaRecord = {
      ...record,
      validaciones: {
        ...record.validaciones,
        [tipo]: {
          ...record.validaciones[tipo],
          estado,
          observacion,
          usuario: 'Usuario actual',
          fecha: new Date().toISOString(),
        },
      },
    };
    const hasBlock = Object.values(next.validaciones).some(
      (v) => v.estado !== 'Aprobado',
    );
    next.alertas = hasBlock
      ? [
          {
            id: 'val-block',
            tipo: 'Validación pendiente',
            estado: 'Activa',
            descripcion:
              'Hay validaciones pendientes o rechazadas — envío a PMO bloqueado.',
            fecha: new Date().toISOString(),
          },
        ]
      : [];
    next.estadoRevision = Object.values(next.validaciones).every(
      (v) => v.estado === 'Aprobado',
    )
      ? 'Aprobada'
      : 'EnRevision';
    save(next);
  }

  // Kickoff y Datos proyecto sólo se abren con la viabilidad técnica y
  // financiera aprobada: son los pasos que alimentan el envío a PMO, y
  // llenarlos antes de la aprobación produce datos que habría que rehacer.
  const validacionesPendientes = VALIDACION_TIPOS.filter(
    (tipo) => record.validaciones[tipo].estado !== 'Aprobado',
  );
  const kickoffHabilitado = puedeEnviarKickoff(record);
  const motivoBloqueo = kickoffHabilitado
    ? null
    : `Aprueba la viabilidad ${validacionesPendientes.join(' y ')} para habilitar esta sección.`;

  // Si la viabilidad se revierte mientras el usuario está en una pestaña
  // bloqueada, se la devuelve a Viabilidad en vez de dejarla editando algo
  // que ya no debería tocar.
  const tabActivo: Tab =
    !kickoffHabilitado && tab !== 'validaciones' ? 'validaciones' : tab;

  const tabBtn = (t: Tab, label: string, bloqueado = false) => (
    <button
      type="button"
      disabled={bloqueado}
      title={bloqueado ? (motivoBloqueo ?? undefined) : undefined}
      className={`-mb-px border-b-2 px-4 py-2 text-sm ${
        bloqueado
          ? 'cursor-not-allowed border-transparent text-muted/50'
          : tabActivo === t
            ? 'border-accent font-bold text-accent'
            : 'border-transparent text-muted hover:text-accent'
      }`}
      onClick={() => setTab(t)}
    >
      {label}
    </button>
  );

  const headerOuv = ouv ?? ouvFromVentaRecord(record);
  const pmo = puedeEnviarAPmo(record);

  return (
    <AppLayout title={record.consecutivo}>
      <div className="mb-3">
        <Link to="/offers" className="text-sm text-accent hover:underline">
          ← Bandeja soporte comercial
        </Link>
      </div>

      {toast ? (
        <p className="mb-3 rounded border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">
          {toast}
        </p>
      ) : null}

      <OuvReadonlyHeaderCard
        ouv={headerOuv}
        extensions={ouvExtensions}
        footer={
          record.envioPmo.estado === 'Enviado' ? (
            <div className={`${badgeClass} bg-positive/15 text-positive`}>
              Enviado · {record.envioPmo.consecutivoControlProyectos}
              {record.envioPmo.serConsecutivo
                ? ` · ${record.envioPmo.serConsecutivo}`
                : ''}
            </div>
          ) : null
        }
      />

      <nav
        className="mb-4 flex flex-wrap items-center gap-1 border-b border-border"
        aria-label="Detalle venta ganada"
      >
        {tabBtn('validaciones', 'Viabilidad')}
        {tabBtn('kickoff', 'Kickoff', !kickoffHabilitado)}
        {tabBtn('datos', 'Datos proyecto', !kickoffHabilitado)}
        {tabActivo === 'datos' ? (
          <div className="ml-auto flex items-center pb-1">
            <button
              type="button"
              className={primaryButtonClass}
              disabled={!pmo.ok}
              title={pmo.reason ?? 'Crear proyecto en Control de Proyectos'}
              onClick={() => setShowResumen(true)}
            >
              Crear Proyecto
            </button>
          </div>
        ) : null}
      </nav>

      {record.alertas.map((a) => (
        <AlertaBanner key={a.id} alerta={a} />
      ))}

      {tabActivo === 'validaciones' ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {VALIDACION_TIPOS.map((tipo) => {
              const v = record.validaciones[tipo];
              return (
                <div key={tipo} className={`${cardClass} flex h-full flex-col p-4`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">{tipo}</span>
                    <span className="text-xs text-muted">
                      {VALIDACION_ESTADO_LABEL[v.estado]}
                    </span>
                  </div>
                  <select
                    className={selectClass}
                    value={v.estado}
                    onChange={(e) =>
                      setValidacion(
                        tipo,
                        e.target.value as typeof v.estado,
                        v.observacion,
                      )
                    }
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Rechazado">Rechazado</option>
                  </select>
                  <label className={`${labelClass} mt-2`}>Observación</label>
                  <textarea
                    className={`${inputClass} min-h-16 flex-1 py-2`}
                    value={v.observacion}
                    onChange={(e) =>
                      setValidacion(tipo, v.estado, e.target.value)
                    }
                  />

                  <div className="mt-3 rounded border border-border bg-bg p-3">
                    <p className="mb-1 text-xs font-bold text-muted">
                      Documento SharePoint
                    </p>
                    {v.sharepointUrl ? (
                      <button
                        type="button"
                        className="inline-flex max-w-full items-center gap-2 text-left text-sm font-bold text-accent hover:underline"
                        onClick={() =>
                          setPreview({
                            title: v.sharepointNombre ?? 'Documento',
                            url: v.sharepointUrl!,
                          })
                        }
                      >
                        <ExternalLink size={15} aria-hidden />
                        <span className="truncate">
                          {v.sharepointNombre ?? v.sharepointUrl}
                        </span>
                      </button>
                    ) : (
                      <p className="text-xs text-muted">Sin documento vinculado.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {puedeEnviarKickoff(record) ? (
            <p className="text-sm text-positive">
              Viabilidad técnica y financiera aprobada — kickoff habilitado.
            </p>
          ) : null}
        </div>
      ) : null}

      {tabActivo === 'kickoff' ? (
        <KickoffCard
          ouvId={record.ouvId}
          accountId={headerOuv.account_id}
          empresaNombre={headerOuv.empresa_nombre || record.empresaNombre}
          kickoff={record.kickoff}
          onChange={(kickoff) => void saveKickoffRecord(kickoff)}
        />
      ) : null}

      {tabActivo === 'datos' ? (
        <>
          <FormularioDatosProyecto
            datos={record.datosBase}
            modo="crear"
            onChange={(datosBase) => save({ ...record, datosBase })}
          />
          {!pmo.ok && pmo.reason ? (
            <p className="mt-2 text-xs text-muted">{pmo.reason}</p>
          ) : null}
        </>
      ) : null}

      <ResumenEnvioPmoModal
        record={record}
        open={showResumen}
        onClose={() => setShowResumen(false)}
        onSent={(updated) => {
          // Por `save` y no `setRecord`: el consecutivo del PMO tiene que
          // quedar en el backend, o el resto de usuarios no lo vería.
          save(updated);
          setToast(
            `Proyecto abierto en Control de Proyectos: ${updated.envioPmo.consecutivoControlProyectos}`,
          );
          navigate('/services');
        }}
      />

      <SharePointPreviewModal
        open={Boolean(preview)}
        title={preview?.title ?? ''}
        url={preview?.url ?? ''}
        onClose={() => setPreview(null)}
      />
    </AppLayout>
  );
}

export default VentaGanadaDetailPage;
