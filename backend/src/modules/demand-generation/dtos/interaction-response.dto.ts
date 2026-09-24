export type InteractionEtapa = 'Previa' | 'SQL';

export class InteractionResponseDto {
  interaction_id: string;
  lead_id: string;
  sql_id: string | null;
  etapa: InteractionEtapa;
  tipo: string;
  subtipo: string | null;
  canal: string;
  descripcion: string | null;
  resultado: string | null;
  campana_id: string | null;
  responsable_id: string;
  responsable_nombre: string | null;
  responsable_rol: string | null;
  fecha: Date;
  created_at: Date;
  updated_at: Date;
}
