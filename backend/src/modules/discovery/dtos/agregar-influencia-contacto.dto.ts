import { IsUUID } from 'class-validator';

export class AgregarInfluenciaContactoDto {
  @IsUUID()
  contacto_ouv_id!: string;
}
