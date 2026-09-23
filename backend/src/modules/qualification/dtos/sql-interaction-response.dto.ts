export class SqlInteractionResponseDto {
  sql_interaction_id!: string;
  sql_id!: string;
  tipo!: string;
  subtipo!: string | null;
  canal!: string;
  descripcion!: string | null;
  responsable_id!: string;
  fecha!: Date;
  created_at!: Date;
  updated_at!: Date;
}
