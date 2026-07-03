import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  InteractionCanal,
  InteractionResultado,
  InteractionTipo,
} from '../models/enums/interaction.enums';

export class CreateInteractionDto {
  @IsEnum(InteractionTipo)
  tipo: InteractionTipo;

  @IsEnum(InteractionCanal)
  canal: InteractionCanal;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subtipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsEnum(InteractionResultado)
  resultado?: InteractionResultado;

  @IsOptional()
  @IsUUID('4')
  campana_id?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;
}
