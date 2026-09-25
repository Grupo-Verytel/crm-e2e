import { SqlCitaEstado } from '../models/enums/sql-cita-estado.enum';
import type { SqlAppointmentEventPayload } from '../models/sql-appointment-event.model';

export class SqlAppointmentEventResponseDto {
  sql_appointment_event_id: string;
  sql_id: string;
  event_type: SqlCitaEstado;
  occurred_at: Date;
  actor_user_id: string;
  actor_name: string | null;
  payload: SqlAppointmentEventPayload | null;
  notes: string | null;
}
