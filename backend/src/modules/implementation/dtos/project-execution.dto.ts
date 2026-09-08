/**
 * Aggregate the PMO derives from its week-by-week rows, so the card can show a
 * figure and not just a percentage.
 */
export class ExecutionSummaryDto {
  projectedTotal!: number;
  actualTotal!: number;
  /** Last week with actual data, and the date of that cut-off. */
  lastWeek!: number | null;
  totalWeeks!: number;
  lastDate!: string | null;
}

/** Scope counts deliverables, not weeks. */
export class ScopeSummaryDto {
  completed!: number;
  total!: number;
}

/** One of the four execution indicators exposed by the PMO. */
export class ExecutionIndicatorDto {
  deviation!: number;
  percentage!: number;
  source!: string;
  /** Source of truth: with `false` the project has no data loaded yet. */
  available!: boolean;
  summary?: ExecutionSummaryDto;
}

export class ScopeIndicatorDto {
  deviation!: number;
  percentage!: number;
  source!: string;
  available!: boolean;
  summary?: ScopeSummaryDto;
}

export class ProjectExecutionDto {
  ouvId!: string;
  /** PRO_NCODE — the PMO project id. */
  projectId!: number;
  name!: string | null;
  projectManager!: string | null;
  /** `null` while the PMO has no survey loaded. */
  nps!: number | null;
  billing!: ExecutionIndicatorDto;
  costs!: ExecutionIndicatorDto;
  schedule!: ExecutionIndicatorDto;
  scope!: ScopeIndicatorDto;
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
