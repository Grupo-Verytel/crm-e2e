/**
 * Thrown when a workflow guard rejects a transition (EARS-02).
 * Mapped to HTTP 422 by WorkflowExceptionFilter.
 */
export class WorkflowGuardRejectedException extends Error {
  readonly codigoError = 'WF_GUARD_REJECTED' as const;

  constructor(
    readonly guard: string,
    readonly detalle: string,
  ) {
    super(`Workflow guard rejected: ${guard} — ${detalle}`);
    this.name = 'WorkflowGuardRejectedException';
  }
}
