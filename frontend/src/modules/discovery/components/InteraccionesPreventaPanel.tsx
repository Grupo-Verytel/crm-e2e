import { useEffect, useState } from 'react';
import type { Ouv } from '../api/ouvs-api';
import {
  loadOuvInteracciones,
  saveOuvInteracciones,
  type InteraccionEntry,
  type InteraccionRecord,
} from '../lib/ouv-interacciones';
import { ModalShell } from './ModalShell';
import { FloatingToast } from './FloatingToast';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

type Props = {
  ouv: Ouv;
};

type ModalMode =
  | { kind: 'nueva' }
  | { kind: 'hilo'; parentId: string; parentTitulo: string };

function InteraccionFormModal({
  mode,
  onClose,
  onSave,
}: {
  mode: ModalMode;
  onClose: () => void;
  onSave: (entry: { titulo: string; observaciones: string }) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const fechaAuto = new Date().toISOString();

  const isHilo = mode.kind === 'hilo';
  const title = isHilo ? 'Responder hilo' : 'Registrar interacción';

  return (
    <ModalShell title={title} onClose={onClose}>
      {isHilo ? (
        <p className="mb-3 text-sm text-muted">
          Respuesta a:{' '}
          <span className="font-bold text-ink">{mode.parentTitulo}</span>
        </p>
      ) : null}

      <div className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="int-titulo">
            Título de la interacción
          </label>
          <input
            id="int-titulo"
            className={inputClass}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Seguimiento técnico sede Norte"
            autoFocus
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="int-fecha">
            Fecha registrada
          </label>
          <input
            id="int-fecha"
            className={inputClass}
            value={new Date(fechaAuto).toLocaleString('es-CO')}
            disabled
            readOnly
          />
          <p className="mt-1 text-xs text-muted">
            Generada automáticamente por el sistema.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="int-obs">
            Observaciones
          </label>
          <textarea
            id="int-obs"
            className={`${inputClass} min-h-24 py-2`}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas, acuerdos, pendientes…"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className={ghostButtonClass} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          disabled={!titulo.trim()}
          onClick={() =>
            onSave({
              titulo: titulo.trim(),
              observaciones: observaciones.trim(),
            })
          }
        >
          {isHilo ? 'Registrar respuesta' : 'Registrar'}
        </button>
      </div>
    </ModalShell>
  );
}

function Etiquetas({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

/** Registro de interacciones / actividades realizadas con el proyecto. */
export function InteraccionesPreventaPanel({ ouv }: Props) {
  const [items, setItems] = useState<InteraccionRecord[]>([]);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadOuvInteracciones(ouv.ouv_id));
    setModal(null);
    setToast(null);
  }, [ouv.ouv_id]);

  function persist(list: InteraccionRecord[]) {
    setItems(list);
    saveOuvInteracciones(ouv.ouv_id, list);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }

  function handleSave(data: { titulo: string; observaciones: string }) {
    if (!modal) return;
    const now = new Date().toISOString();
    const entry: InteraccionEntry = {
      id: `int-${Date.now()}`,
      titulo: data.titulo,
      observaciones: data.observaciones,
      fechaRegistrada: now,
      registradoPor: 'Usuario actual',
    };

    if (modal.kind === 'nueva') {
      persist([{ ...entry, hilos: [] }, ...items]);
      showToast('Interacción registrada correctamente.');
    } else {
      persist(
        items.map((item) =>
          item.id === modal.parentId
            ? { ...item, hilos: [...item.hilos, entry] }
            : item,
        ),
      );
      showToast('Respuesta agregada al hilo.');
    }
    setModal(null);
  }

  function handleDelete(id: string) {
    persist(items.filter((i) => i.id !== id));
  }

  function handleDeleteHilo(parentId: string, hiloId: string) {
    persist(
      items.map((item) =>
        item.id === parentId
          ? { ...item, hilos: item.hilos.filter((h) => h.id !== hiloId) }
          : item,
      ),
    );
  }

  return (
    <section className={`${cardClass} mb-4 p-4`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Interacciones</h2>
          <p className="text-xs text-muted">
            Registra las actividades realizadas con el proyecto (seguimiento
            operativo).
          </p>
        </div>
        <button
          type="button"
          className={ghostButtonClass}
          onClick={() => setModal({ kind: 'nueva' })}
        >
          Registrar interacción
        </button>
      </div>

      {toast ? (
        <FloatingToast
          message={toast}
          tone="success"
          onDismiss={() => setToast(null)}
        />
      ) : null}

      {items.length === 0 ? (
        <p className="rounded border border-dashed border-border bg-bg px-3 py-6 text-center text-sm text-muted">
          Aún no hay interacciones registradas para esta OUV.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded border border-border bg-bg p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{item.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(item.fechaRegistrada).toLocaleString('es-CO')}
                    {' · '}
                    {item.registradoPor}
                  </p>
                  <Etiquetas tags={item.etiquetas} />
                  {item.observaciones ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                      {item.observaciones}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Sin observaciones</p>
                  )}
                  <button
                    type="button"
                    className="mt-2 text-sm font-bold text-accent hover:underline"
                    onClick={() =>
                      setModal({
                        kind: 'hilo',
                        parentId: item.id,
                        parentTitulo: item.titulo,
                      })
                    }
                  >
                    Responder hilo
                  </button>
                </div>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-danger"
                  onClick={() => handleDelete(item.id)}
                >
                  Eliminar
                </button>
              </div>
              {item.hilos.length > 0 ? (
                <ul className="mt-3 space-y-2 border-t border-border pt-3">
                  {item.hilos.map((hilo) => (
                    <li
                      key={hilo.id}
                      className="rounded border border-border/70 bg-surface px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-ink">
                            {hilo.titulo}
                          </p>
                          <p className="text-xs text-muted">
                            {new Date(hilo.fechaRegistrada).toLocaleString(
                              'es-CO',
                            )}
                          </p>
                          <Etiquetas tags={hilo.etiquetas} />
                          {hilo.observaciones ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                              {hilo.observaciones}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="text-xs text-muted hover:text-danger"
                          onClick={() => handleDeleteHilo(item.id, hilo.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {modal ? (
        <InteraccionFormModal
          mode={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      ) : null}
    </section>
  );
}
