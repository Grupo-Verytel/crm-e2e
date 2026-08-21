/**
 * Canonical entity kinds for workflow transitions and notifications.entity_type.
 * Shared by the Notification model and WorkflowEngineService.
 */
export enum EntityType {
  LEAD = 'LEAD',
  MQL = 'MQL',
  SQL = 'SQL',
  CAMPANA = 'CAMPANA',
  OUV = 'OUV',
  PRE = 'PRE',
  PRI = 'PRI',
  SER = 'SER',
  FACTURA = 'FACTURA',
}
