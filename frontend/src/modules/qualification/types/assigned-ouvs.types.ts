export type FollowUpStatus = 'RED' | 'YELLOW' | 'GREEN' | 'NONE';

/** Row of GET /api/v1/qualification/assigned-ouvs. Dates arrive as ISO strings. */
export type AssignedOuvItem = {
  ouv_id: string;
  consecutivo: string;
  titulo: string;
  empresa_nombre: string;
  zona_actual: string;
  comercial_id: string;
  comercial_nombre: string | null;
  next_reminder_at: string | null;
  follow_up_status: FollowUpStatus;
};

export type AssignedOuvFilters = {
  comercial_id: string;
  follow_up_status: FollowUpStatus[];
};
