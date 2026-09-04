import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { AppLayout } from '../../../layout/AppLayout';
import { AlertaBanner } from '../../shared/project/AlertaBadge';
import {
  getVentaGanada,
  puedeEnviarKickoff,
  upsertVentaGanada,
} from '../../shared/project/mock-store';
import type {
  ValidacionTipo,
  VentaGanadaRecord,
} from '../../shared/project/types';
import {
  VALIDACION_ESTADO_LABEL,
  VALIDACION_TIPOS,
} from '../../shared/project/types';
import { FormularioDatosProyecto } from '../components/FormularioDatosProyecto';
import { KickoffCard } from '../components/KickoffCard';
import { OfferClosingNav } from '../components/OfferClosingNav';
import { ResumenEnvioPmoModal } from '../components/ResumenEnvioPmoModal';
import { SharePointPreviewModal } from '../components/SharePointPreviewModal';
import {
  badgeClass,
  cardClass,
  inputClass,
  labelClass,
  selectClass,
} from '../components/ui';

type Tab = 'validaciones' | 'kickoff' | 'datos';

/** Detalle de venta ganada — vista de página (mismo patrón que detalle OUV). */
export function VentaGanadaDetailPage() {
  const { ouvId = '' } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<VentaGanadaRecord | null>(null);
  const [tab, setTab] = useState<Tab>('validaciones');
  const [showResumen, setShowResumen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    title: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    setRecord(getVentaGanada(ouvId));
  }, [ouvId]);

  if (!record) {
    return (
      <AppLayout title="Oferta & Cierre">
        <OfferClosingNav />
        <p className="text-sm text-muted">Registro no encontrado.</p>
        <Link to="/offers" className="mt-3 inline-block text-sm text-accent hover:underline">
          ← Bandeja soporte comercial
        </Link>
      </AppLayout>
    );
  }

  function save(next: VentaGanadaRecord) {
    setRecord(upsertVentaGanada(next));
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

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      className={`-mb-px border-b-2 px-4 py-2 text-sm ${
        tab === t
          ? 'border-accent font-bold text-accent'
          : 'border-transparent text-muted hover:text-accent'
      }`}
      onClick={() => setTab(t)}
    >
      {label}
    </button>
  );

  return (
    <AppLayout title={record.consecutivo}>
      <OfferClosingNav />
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

      <header className={`${cardClass} mb-4 p-4`}>
        <p className="text-xs text-muted">OUV ganada</p>
        <h1 className="text-xl font-bold text-accent">{record.consecutivo}</h1>
        <p className="text-sm text-ink">{record.titulo}</p>
        <p className="mt-1 text-xs text-muted">
          {record.empresaNombre} · {record.vendedorNombre}
        </p>
        {record.envioPmo.estado === 'Enviado' ? (
          <div className={`${badgeClass} mt-3 bg-positive/15 text-positive`}>
            Enviado · {record.envioPmo.serConsecutivo} · CP{' '}
            {record.envioPmo.consecutivoControlProyectos}
          </div>
        ) : null}
      </header>

      <nav
        className="mb-4 flex flex-wrap gap-1 border-b border-border"
        aria-label="Detalle venta ganada"
      >
        {tabBtn('validaciones', 'Validaciones')}
        {tabBtn('kickoff', 'Kickoff')}
        {tabBtn('datos', 'Datos proyecto')}
      </nav>

      {record.alertas.map((a) => (
        <AlertaBanner key={a.id} alerta={a} />
      ))}

      {tab === 'validaciones' ? (
        <div className="space-y-4">
          {VALIDACION_TIPOS.map((tipo) => {
            const v = record.validaciones[tipo];
            return (
              <div key={tipo} className={`${cardClass} p-4`}>
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
                  className={`${inputClass} min-h-16 py-2`}
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
          {puedeEnviarKickoff(record) ? (
            <p className="text-sm text-positive">
              Validaciones técnica y financiera aprobadas — kickoff habilitado.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'kickoff' ? (
        <KickoffCard
          record={record}
          onChange={(kickoff) => save({ ...record, kickoff })}
          onOpenResumen={() => setShowResumen(true)}
        />
      ) : null}

      {tab === 'datos' ? (
        <FormularioDatosProyecto
          datos={record.datosBase}
          modo="crear"
          onChange={(datosBase) => save({ ...record, datosBase })}
          onNotifyDirector={(nombre) => {
            setToast(`Notificación enviada a ${nombre} (mock)`);
            window.setTimeout(() => setToast(null), 3000);
          }}
        />
      ) : null}

      <ResumenEnvioPmoModal
        record={record}
        open={showResumen}
        onClose={() => setShowResumen(false)}
        onSent={(updated) => {
          setRecord(updated);
          setToast(
            `Proyecto creado en Control de Proyectos: ${updated.envioPmo.serConsecutivo}`,
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
