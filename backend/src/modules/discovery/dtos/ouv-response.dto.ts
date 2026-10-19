export class OuvResponseDto {
  ouv_id!: string;
  consecutivo!: string;
  sql_id_origen!: string | null;
  origen_via!: string;
  origin!: string | null;
  source_channel!: string | null;
  comercial_id!: string;
  comercial_nombre!: string | null;
  account_id!: string | null;
  titulo!: string;
  empresa_nombre!: string;
  city!: string | null;
  region!: string | null;
  is_recurring!: boolean | null;
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
  plazo_ejecucion_meses!: number | null;
  /** YYYY-MM-DD, or null when the commercial has not set a close date. */
  expected_close_date!: string | null;
  created_at!: Date;
  updated_at!: Date;
  dias_por_zona?: {
    UNIVERSO: number;
    ENCIMA_FUNNEL: number;
    EN_FUNNEL: number;
    MAYOR_PROBABILIDAD: number;
  };
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

export class OuvInfluenciaFiltroResponseDto {
  passed!: boolean;
  greenTypes!: string[];
  required!: 2;
}

export class OuvInfluenciasListResponseDto {
  influencias!: OuvInfluenciaResponseDto[];
  filtro!: OuvInfluenciaFiltroResponseDto;
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

export class OuvInteraccionHiloResponseDto {
  ouv_interaction_reply_id!: string;
  titulo!: string;
  observaciones!: string | null;
  fecha_registrada!: Date;
  registrado_por_id!: string;
  registrado_por_nombre!: string;
  created_at!: Date;
}

export class OuvRecordatorioResponseDto {
  reminder_id!: string;
  ouv_interaction_id!: string;
  user_id!: string;
  event_at!: Date;
  remind_days_before!: number;
  remind_at!: Date;
  note!: string | null;
  status!: string;
  completed_at!: Date | null;
  outlook_sync_status!: string;
}

export class OuvRecordatorioListItemDto extends OuvRecordatorioResponseDto {
  responsable_nombre!: string | null;
  interaccion_titulo!: string;
}

export class OuvInteraccionResponseDto {
  ouv_interaction_id!: string;
  ouv_id!: string;
  titulo!: string;
  observaciones!: string | null;
  etiquetas!: string[];
  fecha_registrada!: Date;
  registrado_por_id!: string;
  registrado_por_nombre!: string;
  created_at!: Date;
  hilos!: OuvInteraccionHiloResponseDto[];
  /** Present on create: the reminder just stored, or null when none was asked. */
  recordatorio?: OuvRecordatorioResponseDto | null;
}
