import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Alta de una unión temporal o un aliado desde el expediente. */
export class CreateExecutingCompanyDto {
  /** `base-DV`; admite puntos y espacios. El DV se valida en el servicio. */
  @IsString()
  @MaxLength(30)
  nit: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  nombre: string;
}

export class ExecutingCompanyResponseDto {
  id: string;
  /** `base-DV`, listo para mostrar. */
  nit: string;
  nombre: string;
  active: boolean;
}

export class ExecutingCompanyListDto {
  items: ExecutingCompanyResponseDto[];
}
