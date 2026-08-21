import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchSegments } from '../../demand-generation/api/segments-api';
import type { Segment } from '../../demand-generation/types';
import { ApiError } from '../../auth/types';
import {
  convertirSqlEnOuv,
  type ConvertirSqlPayload,
  type SqlDetail,
} from '../api/sqls-api';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

const VERTICALES = [
  'Seguridad Ciudadana',
  'Defensa',
  'Telecomunicaciones',
  'Smart Cities',
  'Infraestructura Crítica',
  'Educación',
  'Salud',
  'Otros',
] as const;

/** Map segments.name → legacy OuvSegmento ENUM (coexistence). */
function segmentNameToEnum(
  name: string,
): ConvertirSqlPayload['segmento'] {
  if (name === 'Proyectos Especiales') return 'ProyectosEspeciales';
  if (name === 'Gobierno' || name === 'D&S' || name === 'B2B') return name;
  return 'B2B';
}

type Props = {
  sql: SqlDetail;
  onClose: () => void;
  onConverted: (ouvId: string, consecutivo: string) => void;
};

export function ConvertirSqlEnOuvModal({ sql, onClose, onConverted }: Props) {
  const [titulo, setTitulo] = useState(
    String(sql.lead.empresa_nombre ?? ''),
  );
  const [descripcion, setDescripcion] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentId, setSegmentId] = useState<string>(
    String(sql.lead.segment_id ?? ''),
  );
  const [subsegmentId, setSubsegmentId] = useState<string>('');
  const [vertical, setVertical] = useState<string>(VERTICALES[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSegments, setLoadingSegments] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchSegments();
        if (cancelled) return;
        setSegments(data);
        if (!segmentId && data[0]?.id) {
          setSegmentId(data[0].id);
        }
      } catch {
        if (!cancelled) {
          setError('No se pudieron cargar los segmentos.');
        }
      } finally {
        if (!cancelled) setLoadingSegments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Prefill segment_id from lead once; do not depend on segmentId to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSegment = useMemo(
    () => segments.find((s) => s.id === segmentId) ?? null,
    [segments, segmentId],
  );

  const subsegments = selectedSegment?.subsegments ?? [];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!titulo.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    if (!segmentId) {
      setError('El segmento es obligatorio.');
      return;
    }
    const segment = segments.find((s) => s.id === segmentId);
    if (!segment) {
      setError('Segmento inválido.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await convertirSqlEnOuv(sql.sql_id, {
        titulo: titulo.trim(),
        ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
        segmento: segmentNameToEnum(segment.name),
        segment_id: segmentId,
        ...(subsegmentId ? { subsegment_id: subsegmentId } : {}),
        vertical,
      });
      onConverted(result.ouv.ouv_id, result.ouv.consecutivo);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError(err.message || 'No se pudo convertir el SQL (guard rechazado).');
      } else if (err instanceof ApiError) {
        setError(err.message || 'No se pudo convertir el SQL.');
      } else {
        setError('No se pudo convertir el SQL. Inténtalo de nuevo.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded bg-surface p-5 shadow-card"
      >
        <h2 className="text-lg font-bold text-ink">Crear OUV</h2>
        <p className="mt-1 text-sm text-muted">
          Convierte este SQL en una oportunidad en zona UNIVERSO.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className={labelClass} htmlFor="ouv-titulo">
              Título
            </label>
            <input
              id="ouv-titulo"
              className={inputClass}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="ouv-descripcion">
              Descripción (opcional)
            </label>
            <textarea
              id="ouv-descripcion"
              className={`${inputClass} h-24 py-2`}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="ouv-segment-id">
              Segmento
            </label>
            <select
              id="ouv-segment-id"
              className={inputClass}
              value={segmentId}
              onChange={(e) => {
                setSegmentId(e.target.value);
                setSubsegmentId('');
              }}
              required
              disabled={loadingSegments}
            >
              <option value="" disabled>
                {loadingSegments ? 'Cargando…' : 'Seleccionar'}
              </option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {subsegments.length > 0 ? (
            <div>
              <label className={labelClass} htmlFor="ouv-subsegment-id">
                Subsegmento (opcional)
              </label>
              <select
                id="ouv-subsegment-id"
                className={inputClass}
                value={subsegmentId}
                onChange={(e) => setSubsegmentId(e.target.value)}
              >
                <option value="">Sin subsegmento</option>
                {subsegments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className={labelClass} htmlFor="ouv-vertical">
              Vertical
            </label>
            <select
              id="ouv-vertical"
              className={inputClass}
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              required
            >
              {VERTICALES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className={ghostButtonClass}
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button type="submit" className={primaryButtonClass} disabled={busy}>
            {busy ? 'Creando…' : 'Crear OUV'}
          </button>
        </div>
      </form>
    </div>
  );
}
