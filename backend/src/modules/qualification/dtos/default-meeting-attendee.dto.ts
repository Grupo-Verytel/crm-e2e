import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const EMAIL_MESSAGE = 'El correo no es válido.';
const NAME_MESSAGE = 'El nombre no puede pasar de 120 caracteres.';

export class CreateDefaultMeetingAttendeeDto {
  @IsString({ message: EMAIL_MESSAGE })
  @IsNotEmpty({ message: EMAIL_MESSAGE })
  @MaxLength(180, { message: EMAIL_MESSAGE })
  @IsEmail({}, { message: EMAIL_MESSAGE })
  email!: string;

  @IsOptional()
  @IsString({ message: NAME_MESSAGE })
  @MaxLength(120, { message: NAME_MESSAGE })
  name?: string | null;
}

export class UpdateDefaultMeetingAttendeeDto {
  @IsOptional()
  @IsString({ message: NAME_MESSAGE })
  @MaxLength(120, { message: NAME_MESSAGE })
  name?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class DefaultMeetingAttendeeResponseDto {
  default_meeting_attendee_id: string;
  email: string;
  name: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class DefaultMeetingAttendeeListResponseDto {
  items: DefaultMeetingAttendeeResponseDto[];
}

export class DeleteDefaultMeetingAttendeeResponseDto {
  deleted: true;
}
