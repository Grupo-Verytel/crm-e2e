export const SQL_APPOINTMENT_EVENT_TYPES = [
  'Agendada',
  'Reagendada',
  'Cancelada',
  'Realizada',
  'NoAsistio',
] as const;

export type SqlAppointmentEventType =
  (typeof SQL_APPOINTMENT_EVENT_TYPES)[number];

export type SqlAppointmentEvent = {
  sql_appointment_event_id: string;
  sql_id: string;
  event_type: SqlAppointmentEventType;
  occurred_at: string;
  actor_user_id: string;
  actor_name: string | null;
  payload: {
    fecha?: string;
    hora?: string;
    fecha_anterior?: string;
    hora_anterior?: string;
  } | null;
  notes: string | null;
};

export const SQL_APPOINTMENT_EVENT_LABELS: Record<
  SqlAppointmentEventType,
  string
> = {
  Agendada: 'Cita agendada',
  Reagendada: 'Cita reagendada',
  Cancelada: 'Cita cancelada',
  Realizada: 'Reunión ejecutada',
  NoAsistio: 'No asistieron',
};

export function isOpenSqlCitaEstado(estado?: string | null): boolean {
  return (
    estado !== 'Realizada' && estado !== 'NoAsistio' && estado !== 'Cancelada'
  );
}
