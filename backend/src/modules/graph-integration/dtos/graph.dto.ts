import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { GRAPH_ORG_DOMAINS } from '../constants/graph.constants';

/**
 * `YYYY-MM-DDTHH:mm` o `YYYY-MM-DDTHH:mm:ss` — hora local del tenant, sin
 * offset: Graph la interpreta con el `timeZone` que acompaña al valor.
 */
const GRAPH_LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export class GraphUsersQueryDto {
  /** Texto libre: nombre o correo. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** Limita la búsqueda a un dominio de la organización. */
  @IsOptional()
  @IsIn(GRAPH_ORG_DOMAINS)
  domain?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class GraphUserDto {
  id: string;
  displayName: string;
  email: string;
  jobTitle: string | null;
  domain: string;
}

export class GraphUsersResponseDto {
  domains: string[];
  count: number;
  users: GraphUserDto[];
}

export class GraphAvailabilityDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true })
  schedules: string[];

  @Matches(GRAPH_LOCAL_DATETIME, {
    message: 'startTime debe tener el formato YYYY-MM-DDTHH:mm',
  })
  startTime: string;

  @Matches(GRAPH_LOCAL_DATETIME, {
    message: 'endTime debe tener el formato YYYY-MM-DDTHH:mm',
  })
  endTime: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  /**
   * Buzón desde el que se consulta `getSchedule`. Por defecto
   * `GRAPH_ORGANIZER_UPN`; si no hay ninguno, se consulta buzón por buzón.
   */
  @IsOptional()
  @IsEmail()
  organizerUpn?: string;
}

export class GraphScheduleItemDto {
  status: string;
  subject: string | null;
  start: string;
  end: string;
}

export class GraphScheduleDto {
  email: string;
  /** Cadena de dígitos: 0 libre, 1 tentativo, 2 ocupado, 3 fuera, 4 desconocido. */
  availabilityView: string | null;
  items: GraphScheduleItemDto[];
  error: string | null;
}

export class GraphAvailabilityResponseDto {
  startTime: string;
  endTime: string;
  timeZone: string;
  intervalMinutes: number;
  schedules: GraphScheduleDto[];
}

export class GraphAttendeeDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(['required', 'optional', 'resource'])
  type?: 'required' | 'optional' | 'resource';
}

export class CreateGraphMeetingDto {
  /** UPN del organizador; por defecto `GRAPH_ORGANIZER_UPN`. */
  @IsOptional()
  @IsEmail()
  organizerUpn?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject: string;

  @Matches(GRAPH_LOCAL_DATETIME, {
    message: 'startTime debe tener el formato YYYY-MM-DDTHH:mm',
  })
  startTime: string;

  @Matches(GRAPH_LOCAL_DATETIME, {
    message: 'endTime debe tener el formato YYYY-MM-DDTHH:mm',
  })
  endTime: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => GraphAttendeeDto)
  attendees: GraphAttendeeDto[];

  /** Nombre o correo de la sala Verytel (se invita como recurso). */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  room?: string;

  /** Ubicación libre cuando la reunión es presencial fuera de Verytel. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  /** `false` para una reunión solo presencial (sin enlace de Teams). */
  @IsOptional()
  isOnlineMeeting?: boolean;
}

export class GraphMeetingResponseDto {
  eventId: string;
  subject: string;
  start: string;
  end: string;
  timeZone: string;
  organizer: { name: string | null; email: string | null };
  attendees: { name: string | null; email: string | null; type: string }[];
  joinUrl: string | null;
  webLink: string | null;
  location: string | null;
}

export class GraphRoomDto {
  id: string;
  nombre: string;
  email: string;
}

export class GraphStatusResponseDto {
  configured: boolean;
  missingEnv: string[];
  domains: string[];
  timeZone: string;
  organizerUpn: string | null;
  roles: string[];
  canCreateMeetings: boolean;
  rooms: GraphRoomDto[];
}

export class GraphAttendanceQueryDto {
  /** Buzón que organizó la reunión; sin él Graph no expone el informe. */
  @IsEmail()
  organizerUpn: string;

  /** Identificador de la reunión en línea. Alternativa a `joinUrl`. */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  meetingId?: string;

  /** Enlace de Teams guardado en el kickoff; se resuelve a `meetingId`. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  joinUrl?: string;
}

export class GraphAttendeeRecordDto {
  name: string | null;
  email: string | null;
  /** Minutos totales dentro de la reunión, sumando reingresos. */
  totalAttendanceInSeconds: number;
  role: string | null;
  intervals: number;
}

export class GraphAttendanceResponseDto {
  meetingId: string;
  /** `null` cuando la reunión existe pero Teams aún no publicó el informe. */
  reportId: string | null;
  meetingStartDateTime: string | null;
  meetingEndDateTime: string | null;
  totalParticipantCount: number | null;
  attendees: GraphAttendeeRecordDto[];
}
