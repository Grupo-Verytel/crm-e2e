export type CommercialGoal = {
  commercial_goal_id: string;
  user_id: string;
  commercial_full_name: string;
  commercial_role_name: string;
  fiscal_year: number;
  quarter: number;
  segment_id: string;
  segment_name: string;
  amount_cop: string;
  created_at: string;
  updated_at: string;
};

export type PaginatedCommercialGoals = {
  items: CommercialGoal[];
  total: number;
  page: number;
  limit: number;
};

export type CommercialGoalQuarterSummary = {
  quarter: number;
  total_amount_cop: string;
  commercial_count: number;
};

export type CommercialGoalSummary = {
  fiscal_year: number;
  quarters: CommercialGoalQuarterSummary[];
};

export type CommercialGoalWrite = {
  user_id: string;
  fiscal_year: number;
  quarter: number;
  segment_id: string;
  amount_cop: number;
};

export type GoalListQuery = {
  page?: number;
  limit?: number;
  fiscal_year?: number;
  quarter?: number;
  user_id?: string;
  segment_id?: string;
};
