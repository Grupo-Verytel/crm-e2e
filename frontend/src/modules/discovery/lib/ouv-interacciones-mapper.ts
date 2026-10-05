import type { OuvInteraccion } from '../api/ouv-interacciones-api';
import type { InteraccionRecord } from './ouv-interacciones';

export function mapOuvInteraccion(row: OuvInteraccion): InteraccionRecord {
  return {
    id: row.ouv_interaction_id,
    titulo: row.titulo,
    observaciones: row.observaciones ?? '',
    fechaRegistrada: row.fecha_registrada,
    registradoPor: row.registrado_por_nombre,
    etiquetas: row.etiquetas,
    hilos: row.hilos.map((h) => ({
      id: h.ouv_interaction_reply_id,
      titulo: h.titulo,
      observaciones: h.observaciones ?? '',
      fechaRegistrada: h.fecha_registrada,
      registradoPor: h.registrado_por_nombre,
    })),
  };
}
