import { IsEnum } from 'class-validator';
import { SqlCitaEstado } from '../models/enums/sql-cita-estado.enum';

export class CloseSqlCitaDto {
  @IsEnum([SqlCitaEstado.Realizada, SqlCitaEstado.NoAsistio])
  resultado!: SqlCitaEstado.Realizada | SqlCitaEstado.NoAsistio;
}
