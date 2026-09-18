import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Alta de una interacción o de una respuesta al hilo. Mismo cuerpo. */
export class CrearOuvInteraccionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  observaciones?: string | null;
}
