import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  InteractionCanal,
  InteractionTipo,
} from '../../demand-generation/models/enums/interaction.enums';

export class CreateSqlInteractionDto {
  @IsEnum(InteractionTipo)
  tipo!: InteractionTipo;

  @IsEnum(InteractionCanal)
  canal!: InteractionCanal;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subtipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;
}
