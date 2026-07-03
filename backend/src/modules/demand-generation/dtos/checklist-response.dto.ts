export class ChecklistResponseDto {
  checklist_id: string;
  lead_id: string;
  criterio_sector_objetivo: boolean;
  criterio_necesidad_portafolio: boolean;
  criterio_acceso_decisor: boolean;
  criterio_presupuesto_indicios: boolean;
  resultado: string;
  completado_por: string;
  fecha_completado: Date | null;
  created_at: Date;
  updated_at: Date;
}
