/** One of the four execution indicators exposed by the PMO. */
export class ExecutionIndicatorDto {
  deviation!: number;
  percentage!: number;
  source!: string;
  /** Source of truth: with `false` the project has no data loaded yet. */
  available!: boolean;
}

export class ProjectExecutionDto {
  ouvId!: string;
  /** PRO_NCODE — the PMO project id. */
  projectId!: number;
  billing!: ExecutionIndicatorDto;
  costs!: ExecutionIndicatorDto;
  schedule!: ExecutionIndicatorDto;
  scope!: ExecutionIndicatorDto;
}

export class ProjectStateTransitionDto {
  previousState!: string | null;
  newState!: string;
  occurredAt!: string;
}

export class ProjectStateHistoryDto {
  ouvId!: string;
  projectId!: number;
  history!: ProjectStateTransitionDto[];
}
