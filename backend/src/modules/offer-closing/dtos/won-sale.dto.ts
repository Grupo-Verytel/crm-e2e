import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  AlertaEstado,
  EmpresaEjecutora,
  EnvioPmoEstado,
  EstadoRevision,
  TipoVenta,
  ValidacionEstado,
  ValidacionTipo,
} from '../models';

const ESTADOS_REVISION: EstadoRevision[] = [
  'Pendiente',
  'EnRevision',
  'Aprobada',
];
const TIPOS_VENTA: TipoVenta[] = ['Licitacion', 'VentaDirecta'];
const ENVIO_PMO_ESTADOS: EnvioPmoEstado[] = [
  'NoEnviado',
  'Pendiente',
  'Enviado',
  'Rechazado',
  'Error',
];
const VALIDACION_TIPOS: ValidacionTipo[] = ['Tecnica', 'Financiera'];
const VALIDACION_ESTADOS: ValidacionEstado[] = [
  'Pendiente',
  'Aprobado',
  'Rechazado',
];
const EMPRESAS: EmpresaEjecutora[] = ['Frisson', 'Verytel', 'UT'];
const ALERTA_ESTADOS: AlertaEstado[] = ['Pendiente', 'Activa', 'Resuelta'];

/** `YYYY-MM-DD` — el formulario no maneja horas para las fechas del proyecto. */
const FECHA_SOLA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Filtro del listado. Se piden los expedientes de unas OUV concretas —las que
 * el usuario ya puede ver— en lugar de devolver la tabla entera.
 */
export class ListWonSalesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  ouvIds?: string;
}

export class WonSaleValidacionDto {
  @IsIn(VALIDACION_TIPOS)
  tipo: ValidacionTipo;

  @IsIn(VALIDACION_ESTADOS)
  estado: ValidacionEstado;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  observacion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  usuario?: string | null;

  @IsOptional()
  @IsISO8601()
  fecha?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sharepointUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sharepointNombre?: string | null;
}

export class WonSaleMiembroDto {
  /** Identidad que asigna el frontend; el nombre es editable. */
  @IsString()
  @MaxLength(64)
  refId: string;

  @IsString()
  @MaxLength(255)
  nombre: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  participacionPct: number;

  @IsOptional()
  @IsIn(EMPRESAS)
  empresa?: EmpresaEjecutora | null;
}

export class WonSaleAlertaDto {
  @IsString()
  @MaxLength(64)
  refId: string;

  @IsString()
  @MaxLength(120)
  tipo: string;

  @IsIn(ALERTA_ESTADOS)
  estado: AlertaEstado;

  @IsString()
  @MaxLength(2000)
  descripcion: string;

  @IsOptional()
  @IsISO8601()
  fecha?: string | null;
}

export class WonSaleHistorialDto {
  @IsString()
  @MaxLength(160)
  estado: string;

  @IsISO8601()
  fecha: string;

  @IsString()
  @MaxLength(120)
  origen: string;
}

export class SaveWonSaleDto {
  @IsIn(ESTADOS_REVISION)
  estadoRevision: EstadoRevision;

  @IsString()
  @MaxLength(255)
  nombreProyecto: string;

  @IsOptional()
  @Matches(FECHA_SOLA, {
    message: 'fechaInicio debe tener el formato YYYY-MM-DD',
  })
  fechaInicio?: string | null;

  @IsOptional()
  @Matches(FECHA_SOLA, { message: 'fechaFin debe tener el formato YYYY-MM-DD' })
  fechaFin?: string | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorFacturar: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoEstimado: number;

  @IsBoolean()
  recurrente: boolean;

  @IsIn(TIPOS_VENTA)
  tipoVenta: TipoVenta;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  directorProyectoId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  directorProyectoNombre?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  centroCostos?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ubv?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  participacion?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  participacionPct: number;

  @IsIn(ENVIO_PMO_ESTADOS)
  envioPmoEstado: EnvioPmoEstado;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  envioPmoConsecutivo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  envioPmoSer?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  envioPmoMotivo?: string | null;

  @IsOptional()
  @IsISO8601()
  envioPmoEnviadoEn?: string | null;

  /** Bloques todavía sin fuente real; se guardan tal cual los manda el front. */
  @IsOptional()
  indicadores?: unknown;

  @IsOptional()
  csat?: unknown;

  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => WonSaleValidacionDto)
  validaciones: WonSaleValidacionDto[];

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => WonSaleMiembroDto)
  miembros: WonSaleMiembroDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WonSaleAlertaDto)
  alertas: WonSaleAlertaDto[];

  /**
   * Entradas nuevas de la bitácora. El servicio las añade a las que ya existen
   * en lugar de reemplazarlas: la historia no se reescribe.
   */
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WonSaleHistorialDto)
  historial: WonSaleHistorialDto[];
}

export class WonSaleValidacionResponseDto extends WonSaleValidacionDto {
  wonSaleValidationId: string;
}

export class WonSaleMiembroResponseDto extends WonSaleMiembroDto {
  wonSaleMemberId: string;
}

export class WonSaleAlertaResponseDto extends WonSaleAlertaDto {
  wonSaleAlertId: string;
}

export class WonSaleHistorialResponseDto extends WonSaleHistorialDto {
  wonSaleHistoryEntryId: string;
}

export class WonSaleResponseDto {
  wonSaleId: string;
  ouvId: string;
  estadoRevision: EstadoRevision;
  nombreProyecto: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  valorFacturar: number;
  costoEstimado: number;
  recurrente: boolean;
  tipoVenta: TipoVenta;
  directorProyectoId: string | null;
  directorProyectoNombre: string | null;
  centroCostos: string | null;
  ubv: string | null;
  participacion: string | null;
  participacionPct: number;
  envioPmoEstado: EnvioPmoEstado;
  envioPmoConsecutivo: string | null;
  envioPmoSer: string | null;
  envioPmoMotivo: string | null;
  envioPmoEnviadoEn: string | null;
  indicadores: unknown;
  csat: unknown;
  validaciones: WonSaleValidacionResponseDto[];
  miembros: WonSaleMiembroResponseDto[];
  alertas: WonSaleAlertaResponseDto[];
  historial: WonSaleHistorialResponseDto[];
  createdAt: string;
  updatedAt: string;
}

/**
 * `null` cuando la OUV todavía no tiene expediente. Es un estado normal, no un
 * error: distingue «aún no diligenciado» de «falló la consulta».
 */
export class WonSaleEnvelopeDto {
  wonSale: WonSaleResponseDto | null;
}

export class WonSaleListDto {
  wonSales: WonSaleResponseDto[];
}
