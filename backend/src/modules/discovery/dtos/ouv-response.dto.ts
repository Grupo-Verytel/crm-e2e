export class OuvResponseDto {
  ouv_id!: string;
  consecutivo!: string;
  sql_id_origen!: string | null;
  origen_via!: string;
  comercial_id!: string;
  account_id!: string | null;
  titulo!: string;
  empresa_nombre!: string;
  descripcion!: string | null;
  segmento!: string;
  segment_id!: string | null;
  subsegment_id!: string | null;
  vertical!: string;
  zona_actual!: string;
  resultado!: string;
  tiene_gap!: boolean;
  criterios_faltantes!: string[] | null;
  presupuesto_confirmado!: boolean;
  presupuesto_monto!: string | null;
  presupuesto_moneda!: string | null;
  presupuesto_fecha_captura!: Date | null;
  presupuesto_fuente!: string | null;
  motivo_id!: string | null;
  motivo_snapshot!: string | null;
  motivo_detalle!: string | null;
  competidor_ganador!: string | null;
  monto_final!: string | null;
  moneda_final!: string | null;
  monto_estimado_perdido!: string | null;
  fecha_cierre!: Date | null;
  created_at!: Date;
  updated_at!: Date;
}

export class PaginatedOuvsResponseDto {
  items!: OuvResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
}

export class OuvContactoResponseDto {
  contacto_ouv_id!: string;
  ouv_id!: string;
  person_id!: string;
  name!: string;
  job_title!: string | null;
  email!: string | null;
  phone!: string | null;
  account_id!: string;
  account_name!: string;
  notas!: string | null;
  created_at!: Date;
  updated_at!: Date;
}

export class OuvInfluenciaResponseDto {
  influencia_id!: string;
  ouv_id!: string;
  tipo!: string;
  estado!: string;
  contacto_ouv_id!: string | null;
  notas!: string | null;
  motivo_estado!: string | null;
  fecha_ultimo_cambio!: Date | null;
  created_at!: Date;
}

export class OuvChecklistItemResponseDto {
  item_id!: string;
  ouv_id!: string;
  zona!: string;
  codigo_item!: string;
  label!: string;
  marcado!: boolean;
  marcado_at!: Date | null;
  marcado_por!: string | null;
  created_at!: Date;
}
