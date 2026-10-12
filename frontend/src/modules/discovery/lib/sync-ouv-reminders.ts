import {
  listRemindersForOuv,
  upsertOuvReminder,
} from '../../shared/reminders/store';
import type { Ouv } from '../api/ouvs-api';
import { loadOuvInteracciones } from './ouv-interacciones';

/** Recovers programmed reminders stored on interactions but missing from the tray. */
export function syncOuvRemindersFromInteracciones(ouv: Ouv): void {
  const records = loadOuvInteracciones(ouv.ouv_id);
  const existing = new Set(
    listRemindersForOuv(ouv.ouv_id).map((row) => row.interaccion_id),
  );
  const entries = records.flatMap((item) => [item, ...item.hilos]);
  for (const entry of entries) {
    if (!entry.recordatorioAt || existing.has(entry.id)) continue;
    upsertOuvReminder({
      reminder_id: `rem-${entry.id}`,
      ouv_id: ouv.ouv_id,
      ouv_consecutivo: ouv.consecutivo,
      ouv_titulo: ouv.titulo,
      interaccion_id: entry.id,
      interaccion_titulo: entry.titulo,
      remind_at: entry.recordatorioAt,
      entity_kind: 'OUV',
    });
    existing.add(entry.id);
  }
}
