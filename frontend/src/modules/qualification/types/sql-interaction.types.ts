import type {
  InteractionCanal,
  InteractionTipo,
} from '../../demand-generation/types';

export type SqlInteraction = {
  sql_interaction_id: string;
  sql_id: string;
  tipo: string;
  subtipo: string | null;
  canal: string;
  descripcion: string | null;
  responsable_id: string;
  fecha: string;
  created_at: string;
  updated_at: string;
};

export type CreateSqlInteractionPayload = {
  tipo: InteractionTipo;
  canal: InteractionCanal;
  subtipo?: string;
  descripcion?: string;
  fecha?: string;
};
