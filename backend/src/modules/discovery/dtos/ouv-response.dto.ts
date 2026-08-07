export class OuvResponseDto {
  ouv_id!: string;
  consecutivo!: string;
  sql_id_origen!: string;
  comercial_id!: string;
  titulo!: string;
  descripcion!: string | null;
  segmento!: string;
  vertical!: string;
  zona_actual!: string;
  resultado!: string;
  created_at!: Date;
  updated_at!: Date;
}
