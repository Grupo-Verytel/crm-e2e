import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type {
  KickoffInviteeType,
  KickoffLocationType,
  KickoffStatus,
} from '../models';

const LOCATION_TYPES: KickoffLocationType[] = ['Teams', 'Presencial'];
const STATUSES: KickoffStatus[] = ['Programado', 'Realizado', 'Cancelado'];
const INVITEE_TYPES: KickoffInviteeType[] = [
  'Interno',
  'ContactoOuv',
  'Externo',
];

export class KickoffInviteeDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  displayName: string;

  @IsIn(INVITEE_TYPES)
  inviteeType: KickoffInviteeType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceRef?: string | null;
}

export class KickoffApprovalDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label: string;

  @IsBoolean()
  completed: boolean;
}

/** Cuerpo del `PUT`: reemplaza por completo el kickoff de la OUV. */
export class SaveKickoffDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsISO8601()
  startsAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endsAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;

  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(LOCATION_TYPES, { each: true })
  locationTypes: KickoffLocationType[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  roomEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  roomLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationDetail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsIn(STATUSES)
  status: KickoffStatus;

  @IsBoolean()
  schedulingConfirmed: boolean;

  @IsBoolean()
  teamsValidated: boolean;

  @IsOptional()
  @IsISO8601()
  heldAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  graphEventId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  graphOrganizerUpn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  joinUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  webLink?: string | null;

  @IsOptional()
  @IsISO8601()
  confirmedAt?: string | null;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => KickoffInviteeDto)
  invitees: KickoffInviteeDto[];

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => KickoffApprovalDto)
  approvals: KickoffApprovalDto[];
}

export class KickoffInviteeResponseDto extends KickoffInviteeDto {
  kickoffInviteeId: string;
}

export class KickoffApprovalResponseDto extends KickoffApprovalDto {
  kickoffApprovalId: string;
  completedAt: string | null;
}

export class KickoffResponseDto {
  kickoffId: string;
  ouvId: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  locationTypes: KickoffLocationType[];
  roomEmail: string | null;
  roomLabel: string | null;
  locationDetail: string | null;
  notes: string | null;
  status: KickoffStatus;
  schedulingConfirmed: boolean;
  teamsValidated: boolean;
  heldAt: string | null;
  graphEventId: string | null;
  graphOrganizerUpn: string | null;
  joinUrl: string | null;
  webLink: string | null;
  confirmedAt: string | null;
  invitees: KickoffInviteeResponseDto[];
  approvals: KickoffApprovalResponseDto[];
  createdAt: string;
  updatedAt: string;
}

/**
 * La ausencia de kickoff es un estado normal de la OUV (aún no se agenda), no
 * un 404: por eso la respuesta se envuelve en vez de devolverse suelta.
 */
export class KickoffEnvelopeDto {
  kickoff: KickoffResponseDto | null;
}
