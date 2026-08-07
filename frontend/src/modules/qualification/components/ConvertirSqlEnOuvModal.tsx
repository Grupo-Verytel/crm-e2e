import { useState, type FormEvent } from 'react';
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

const SEGMENTOS: ConvertirSqlPayload['segmento'][] = [
  'Gobierno',
  'D&S',
  'ProyectosEspeciales',
  'B2B',
];

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

type Props = {
  sql: SqlDetail;
  onClose: () => void;
  onConverted: (consecutivo: string) => void;
};

export function ConvertirSqlEnOuvModal({ sql, onClose, onConverted }: Props) {
  const [titulo, setTitulo] = useState(
    String(sql.lead.empresa_nombre ?? ''),
  );
  const [descripcion, setDescripcion] = useState('');
  const [segmento, setSegmento] =
    useState<ConvertirSqlPayload['segmento']>('Gobierno');
  const [vertical, setVertical] = useState<string>(VERTICALES[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!titulo.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await convertirSqlEnOuv(sql.sql_id, {
        titulo: titulo.trim(),
        ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
        segmento,
        vertical,
      });
      onConverted(result.ouv.consecutivo);
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
        className="w-full max-w-lg rounded bg-surface p-5 shadow-card"
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
            <label className={labelClass} htmlFor="ouv-segmento">
              Segmento
            </label>
            <select
              id="ouv-segmento"
              className={inputClass}
              value={segmento}
              onChange={(e) =>
                setSegmento(e.target.value as ConvertirSqlPayload['segmento'])
              }
              required
            >
              {SEGMENTOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

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
          <p className="mt-3 text-sm text-red-600" role="alert">
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
