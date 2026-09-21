import { useEffect, useState } from 'react';
import { ApiError } from '../../auth/types';
import type { Ouv } from '../api/ouvs-api';
import {
  crearOuvInteraccion,
  eliminarOuvInteraccion,
  eliminarOuvInteraccionHilo,
  fetchOuvInteracciones,
  responderOuvInteraccion,
  type OuvInteraccion,
} from '../api/ouv-interacciones-api';
import { FloatingToast } from './FloatingToast';
import { ModalShell } from './ModalShell';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './ui';

/**
 * Registro de interacciones / actividades de la OUV — pestaña «Interacciones».
 *
 * Persiste en `ouv_interactions` + `ouv_interaction_replies`. La autoría la
 * pone el backend leyendo el JWT: el formulario nunca envía nombre ni id,
 * porque la bitácora debe reflejar quién quedó autenticado, no lo que el
 * cliente diga.
 */

type Props = {
  ouv: Ouv;
  /** Sin permiso de escritura: se lista la bitácora pero no se registra, responde ni elimina. */
  readOnly?: boolean;
};

type ModalMode =
  | { kind: 'nueva' }
  | { kind: 'hilo'; parentId: string; parentTitulo: string };

type FormValues = { titulo: string; observaciones: string };

function messageFromError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function InteraccionFormModal({
  mode,
  submitting,
  onClose,
  onSave,
}: {
  mode: ModalMode;
  submitting: boolean;
  onClose: () => void;
  onSave: (entry: FormValues) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [observaciones, setObservaciones] = useState('');

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
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="int-fecha">
            Fecha registrada
          </label>
          <input
            id="int-fecha"
            className={inputClass}
            value={new Date().toLocaleString('es-CO')}
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
        <button
          type="button"
          className={ghostButtonClass}
          onClick={onClose}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          disabled={submitting || !titulo.trim()}
          onClick={() =>
            onSave({
              titulo: titulo.trim(),
              observaciones: observaciones.trim(),
            })
          }
        >
          {submitting
            ? 'Guardando…'
            : isHilo
              ? 'Registrar respuesta'
              : 'Registrar'}
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
export function InteraccionesPreventaPanel({ ouv, readOnly = false }: Props) {
  const [items, setItems] = useState<OuvInteraccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setModal(null);
    fetchOuvInteracciones(ouv.ouv_id)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          messageFromError(err, 'No se pudieron cargar las interacciones.'),
        );
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ouv.ouv_id]);

  function showToast(tone: 'success' | 'error', message: string) {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function handleSave(data: FormValues) {
    if (!modal) return;
    setSubmitting(true);
    try {
      if (modal.kind === 'nueva') {
        const created = await crearOuvInteraccion(ouv.ouv_id, data);
        setItems((prev) => [created, ...prev]);
        showToast('success', 'Interacción registrada correctamente.');
      } else {
        const updated = await responderOuvInteraccion(
          ouv.ouv_id,
          modal.parentId,
          data,
        );
        setItems((prev) =>
          prev.map((item) =>
            item.ouv_interaction_id === updated.ouv_interaction_id
              ? updated
              : item,
          ),
        );
        showToast('success', 'Respuesta agregada al hilo.');
      }
      setModal(null);
    } catch (err) {
      showToast(
        'error',
        messageFromError(err, 'No se pudo guardar la interacción.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.ouv_interaction_id !== id));
    try {
      await eliminarOuvInteraccion(ouv.ouv_id, id);
    } catch (err) {
      setItems(snapshot);
      showToast(
        'error',
        messageFromError(err, 'No se pudo eliminar la interacción.'),
      );
    }
  }

  async function handleDeleteHilo(parentId: string, hiloId: string) {
    const snapshot = items;
    setItems((prev) =>
      prev.map((item) =>
        item.ouv_interaction_id === parentId
          ? {
              ...item,
              hilos: item.hilos.filter(
                (h) => h.ouv_interaction_reply_id !== hiloId,
              ),
            }
          : item,
      ),
    );
    try {
      await eliminarOuvInteraccionHilo(ouv.ouv_id, parentId, hiloId);
    } catch (err) {
      setItems(snapshot);
      showToast(
        'error',
        messageFromError(err, 'No se pudo eliminar la respuesta.'),
      );
    }
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
        {readOnly ? null : (
          <button
            type="button"
            className={ghostButtonClass}
            onClick={() => setModal({ kind: 'nueva' })}
            disabled={loading}
          >
            Registrar interacción
          </button>
        )}
      </div>

      {toast ? (
        <FloatingToast
          message={toast.message}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      ) : null}

      {loading ? (
        <p className="rounded border border-dashed border-border bg-bg px-3 py-6 text-center text-sm text-muted">
          Cargando interacciones…
        </p>
      ) : loadError ? (
        <p
          className="rounded border border-danger bg-danger/10 px-3 py-3 text-sm text-danger"
          role="alert"
        >
          {loadError}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded border border-dashed border-border bg-bg px-3 py-6 text-center text-sm text-muted">
          Aún no hay interacciones registradas para esta OUV.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.ouv_interaction_id}
              className="rounded border border-border bg-bg p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{item.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(item.fecha_registrada).toLocaleString('es-CO')}
                    {' · '}
                    {item.registrado_por_nombre}
                  </p>
                  <Etiquetas tags={item.etiquetas} />
                  {item.observaciones ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                      {item.observaciones}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Sin observaciones</p>
                  )}
                  {readOnly ? null : (
                    <button
                      type="button"
                      className="mt-2 text-sm font-bold text-accent hover:underline"
                      onClick={() =>
                        setModal({
                          kind: 'hilo',
                          parentId: item.ouv_interaction_id,
                          parentTitulo: item.titulo,
                        })
                      }
                    >
                      Responder hilo
                    </button>
                  )}
                </div>
                {readOnly ? null : (
                  <button
                    type="button"
                    className={ghostButtonClass}
                    onClick={() => handleDelete(item.ouv_interaction_id)}
                  >
                    Eliminar
                  </button>
                )}
              </div>

              {item.hilos.length > 0 ? (
                <ul className="mt-3 space-y-2 border-l-2 border-border pl-3">
                  {item.hilos.map((hilo) => (
                    <li
                      key={hilo.ouv_interaction_reply_id}
                      className="rounded border border-border bg-surface p-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-ink">
                            {hilo.titulo}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {new Date(hilo.fecha_registrada).toLocaleString(
                              'es-CO',
                            )}
                            {' · '}
                            {hilo.registrado_por_nombre}
                          </p>
                          {hilo.observaciones ? (
                            <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">
                              {hilo.observaciones}
                            </p>
                          ) : null}
                        </div>
                        {readOnly ? null : (
                          <button
                            type="button"
                            className="text-xs font-bold text-muted hover:text-danger"
                            onClick={() =>
                              handleDeleteHilo(
                                item.ouv_interaction_id,
                                hilo.ouv_interaction_reply_id,
                              )
                            }
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {modal && !readOnly ? (
        <InteraccionFormModal
          mode={modal}
          submitting={submitting}
          onClose={() => (submitting ? null : setModal(null))}
          onSave={handleSave}
        />
      ) : null}
    </section>
  );
}
