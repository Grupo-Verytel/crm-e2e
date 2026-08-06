/**
 * Thrown when eventType is not registered in workflow.rules.ts (config bug).
 * Mapped to HTTP 500 by WorkflowExceptionFilter.
 */
export class WorkflowRuleNotFoundException extends Error {
  readonly codigoError = 'WF_RULE_NOT_FOUND' as const;

  constructor(readonly eventType: string) {
    super(`Workflow rule not found for eventType: ${eventType}`);
    this.name = 'WorkflowRuleNotFoundException';
  }
}
