export class InteractionResponseDto {
  interaction_id: string;
  lead_id: string;
  tipo: string;
  subtipo: string | null;
  canal: string;
  descripcion: string | null;
  resultado: string | null;
  campana_id: string | null;
  responsable_id: string;
  fecha: Date;
  created_at: Date;
  updated_at: Date;
}
