import { IsDateString, IsUUID } from 'class-validator';

export class RegisterAppointmentDto {
  @IsDateString()
  fecha_cita: string;

  @IsUUID('4')
  comercial_asignado_id: string;
}
