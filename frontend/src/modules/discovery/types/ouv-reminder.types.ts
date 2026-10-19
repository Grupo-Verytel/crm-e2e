/** Item of GET /api/v1/discovery/ouvs/:ouvId/recordatorios. */
export type OuvReminderItem = {
  reminder_id: string;
  ouv_interaction_id: string;
  user_id: string;
  event_at: string;
  remind_days_before: number;
  remind_at: string;
  note: string | null;
  status: 'Pendiente' | 'Enviado' | 'Cancelado';
  completed_at: string | null;
  outlook_sync_status: string;
  responsable_nombre: string | null;
  interaccion_titulo: string;
};

/**
 * Controlled value of the "Recordarme" block.
 * `event_at` is the datetime-local string the parent owns. This component
 * does not turn it into UTC.
 */
export type ReminderFieldsValue = {
  enabled: boolean;
  event_at: string;
  remind_days_before: number;
  note: string;
};
