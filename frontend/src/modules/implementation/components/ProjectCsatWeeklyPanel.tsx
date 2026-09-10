import { useState } from 'react';
import { Frown, Meh, Save, Smile } from 'lucide-react';
import { DatePickerField } from '../../../components/DatePickerField';
import type { CsatSemanaEntry, VentaGanadaRecord } from '../../shared/project/types';
import {
  currentIsoWeek,
  isoWeekFromYmd,
  toYmd,
} from '../lib/project-metrics';
import { inputClass, labelClass } from './ui';

type Props = {
  record: VentaGanadaRecord;
  canEdit: boolean;
  onSave: (entry: CsatSemanaEntry) => void;
};

const CSAT_FACES = [
  { value: 1, label: 'Triste', Icon: Frown, toneClass: 'text-danger' },
  { value: 3, label: 'Decepcionado', Icon: Meh, toneClass: 'text-warning' },
  { value: 5, label: 'Feliz', Icon: Smile, toneClass: 'text-success' },
] as const;

function nearestCsatFace(value: number) {
  return CSAT_FACES.reduce((best, face) =>
    Math.abs(face.value - value) < Math.abs(best.value - value) ? face : best,
  );
}

function CsatFaceRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (next: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const selected = nearestCsatFace(hover ?? value);
  const readonly = !onChange;

  if (readonly) {
    return (
      <span
        className={`inline-flex items-center ${selected.toneClass}`}
        title={selected.label}
        aria-label={`CSAT ${selected.label}`}
      >
        <selected.Icon size={22} strokeWidth={2.25} />
      </span>
    );
  }

  return (
    <div
      className="flex h-9 w-full items-center justify-center gap-0.5"
      role={readonly ? 'img' : 'radiogroup'}
      aria-label={`CSAT ${selected.label}`}
      onMouseLeave={() => setHover(null)}
    >
      {CSAT_FACES.map((face) => {
        const active = face.value === selected.value;
        return (
          <button
            key={face.value}
            type="button"
            role={readonly ? undefined : 'radio'}
            aria-checked={readonly ? undefined : active}
            aria-label={face.label}
            title={face.label}
            disabled={readonly}
            className={[
              'grid h-8 w-8 place-items-center rounded',
              readonly ? 'cursor-default' : 'hover:bg-bg',
              active ? face.toneClass : 'text-muted',
            ].join(' ')}
            onMouseEnter={() => {
              if (!readonly) setHover(face.value);
            }}
            onClick={() => onChange?.(face.value)}
          >
            <face.Icon size={22} strokeWidth={active ? 2.5 : 2} />
          </button>
        );
      })}
    </div>
  );
}

/** CSAT semanal: una medición por semana ISO. */
export function ProjectCsatWeeklyPanel({ record, canEdit, onSave }: Props) {
  const semanas = [...(record.csat.semanas ?? [])].sort((a, b) =>
    b.semanaIso.localeCompare(a.semanaIso),
  );
  const [fecha, setFecha] = useState(toYmd(new Date()));
  const [semanaIso, setSemanaIso] = useState(currentIsoWeek());
  const existing = semanas.find((s) => s.semanaIso === semanaIso);
  const [valor, setValor] = useState(
    existing?.valor ?? record.csat.valor ?? 3,
  );
  const [comentario, setComentario] = useState(existing?.comentario ?? '');

  function applyWeek(nextWeek: string) {
    setSemanaIso(nextWeek);
    const found = semanas.find((s) => s.semanaIso === nextWeek);
    setValor(found?.valor ?? record.csat.valor ?? 3);
    setComentario(found?.comentario ?? '');
  }

  function handleDateChange(ymd: string) {
    if (!ymd) return;
    setFecha(ymd);
    const nextWeek = isoWeekFromYmd(ymd);
    if (nextWeek) applyWeek(nextWeek);
  }

  function handleSave() {
    onSave({
      semanaIso,
      valor: Math.round(valor),
      comentario: comentario.trim(),
      registradoEn: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded bg-surface p-4 shadow-card">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-ink">CSAT semanal</h2>
            <p className="mt-1 text-xs text-muted">
              Una medición por semana. Si ya existe, se reemplaza.
            </p>
          </div>
          {canEdit ? (
            <button
              type="button"
              className="icon-btn grid h-9 w-9 shrink-0 place-items-center rounded"
              aria-label="Guardar"
              onClick={handleSave}
            >
              <Save size={16} />
            </button>
          ) : null}
        </div>

        {canEdit ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-[8.5rem_12rem_minmax(0,1fr)]">
            <div>
              <p className={labelClass}>Índice</p>
              <div className="flex h-9 items-center rounded border border-border bg-bg px-1">
                <CsatFaceRating value={valor} onChange={setValor} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="csat-date">
                Semana
              </label>
              <DatePickerField
                id="csat-date"
                value={fecha}
                displayValue={semanaIso}
                onChange={handleDateChange}
                aria-label="Semana de la medición"
              />
            </div>
            <div className="min-w-0">
              <label className={labelClass} htmlFor="csat-comment">
                Comentario
              </label>
              <input
                id="csat-comment"
                className={inputClass}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Hallazgos, quejas o reconocimientos"
              />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Solo lectura: el CSAT semanal lo diligencia Soporte comercial o
            Admin.
          </p>
        )}
      </section>

      <section className="rounded bg-surface p-4 shadow-card">
        <h3 className="mb-2 text-sm font-bold text-ink">Historial semanal</h3>
        {semanas.length === 0 ? (
          <p className="text-sm text-muted">
            Aún no hay mediciones. Usa Guardar para registrar la primera.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-4 py-2 font-bold">Índice</th>
                  <th className="px-4 py-2 font-bold">Semana</th>
                  <th className="px-4 py-2 font-bold">Comentario</th>
                </tr>
              </thead>
              <tbody>
                {semanas.map((row) => (
                  <tr key={row.semanaIso} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <CsatFaceRating value={row.valor} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <p className="font-bold text-ink">{row.semanaIso}</p>
                      <p className="text-xs text-muted">
                        {new Date(row.registradoEn).toLocaleString('es-CO')}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-ink">
                      {row.comentario || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
