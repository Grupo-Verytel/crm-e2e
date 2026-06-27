export interface CaslPermissionRule {
  action: string;
  subject: string;
  conditions?: Record<string, unknown>;
}
