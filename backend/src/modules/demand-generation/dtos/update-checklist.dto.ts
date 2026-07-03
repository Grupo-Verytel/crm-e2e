import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateChecklistDto {
  @IsOptional()
  @IsBoolean()
  criterio_sector_objetivo?: boolean;

  @IsOptional()
  @IsBoolean()
  criterio_necesidad_portafolio?: boolean;

  @IsOptional()
  @IsBoolean()
  criterio_acceso_decisor?: boolean;

  @IsOptional()
  @IsBoolean()
  criterio_presupuesto_indicios?: boolean;
}
