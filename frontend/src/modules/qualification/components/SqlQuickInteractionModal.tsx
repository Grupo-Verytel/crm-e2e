import { useEffect, useMemo, useState } from 'react';
import { ModalShell } from '../../demand-generation/components/ModalShell';
import {
  INTERACTION_CANAL_LABEL,
  INTERACTION_TIPO_LABEL,
  INTERACTION_TIPOS,
  canalesForTipo,
  type InteractionCanal,
  type InteractionTipo,
} from '../../demand-generation/types';
import {
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../../demand-generation/components/ui';
import { registerSqlInteraction } from '../api/sql-interactions-api';

type Props = {
  sqlId: string;
  sqlLabel: string;
  onRegistered: () => void | Promise<void>;
  onClose: () => void;
};

export function SqlQuickInteractionModal({
  sqlId,
  sqlLabel,
  onRegistered,
  onClose,
}: Props) {
  const [tipo, setTipo] = useState<InteractionTipo>('Llamada');
  const canales = useMemo(() => canalesForTipo(tipo), [tipo]);
  const [canal, setCanal] = useState<InteractionCanal>(canales[0] ?? 'Telefono');
  const [descripcion, setDescripcion] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canales.includes(canal)) {
      setCanal(canales[0] ?? 'Telefono');
    }
  }, [canales, canal]);

  async function handleSubmit() {
    if (!descripcion.trim()) {
      setError('La descripción es obligatoria.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await registerSqlInteraction(sqlId, {
        tipo,
        canal,
        descripcion: descripcion.trim(),
      });
      await onRegistered();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo registrar la interacción.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalShell title="Registrar interacción" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Registra una interacción de calificación para {sqlLabel}.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sql-qi-tipo" className={labelClass}>
              Tipo de comunicación
            </label>
            <select
              id="sql-qi-tipo"
              value={tipo}
              onChange={(event) => setTipo(event.target.value as InteractionTipo)}
              className={inputClass}
            >
              {INTERACTION_TIPOS.map((value) => (
                <option key={value} value={value}>
                  {INTERACTION_TIPO_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sql-qi-canal" className={labelClass}>
              Canal
            </label>
            <select
              id="sql-qi-canal"
              value={canal}
              onChange={(event) =>
                setCanal(event.target.value as InteractionCanal)
              }
              className={inputClass}
            >
              {canales.map((value) => (
                <option key={value} value={value}>
                  {INTERACTION_CANAL_LABEL[value]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              Solo canales válidos para{' '}
              {INTERACTION_TIPO_LABEL[tipo].toLowerCase()}.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="sql-qi-desc" className={labelClass}>
            Descripción
          </label>
          <textarea
            id="sql-qi-desc"
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            rows={3}
            placeholder="Ej. Seguimiento post-cita con el contacto del SQL."
            className={`${inputClass} h-auto py-2`}
            required
          />
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving}
            className={primaryButtonClass}
          >
            {isSaving ? 'Guardando…' : 'Guardar interacción'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
