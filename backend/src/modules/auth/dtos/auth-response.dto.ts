export class AuthTokenResponseDto {
  access_token: string;
  refresh_token: string;
  expires_in: string;
}

export class PermissionRuleDto {
  action: string;
  subject: string;
}

export class MeResponseDto {
  user_id: string;
  email: string;
  full_name: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  last_login_at: Date | null;
  permissions: PermissionRuleDto[];
  /** `'own'` only for Gerente Comercial. Everyone else gets `'all'`. */
  ouv_board_default: 'own' | 'all';
  /** EjecutivoComercial and Gerente Comercial may open a direct OUV they will own. */
  can_create_direct_ouv: boolean;
  /**
   * True for an active EjecutivoComercial or Gerente Comercial.
   * Actions on one OUV or SQL also require that user to be the assignee.
   */
  can_act_as_assigned_commercial: boolean;
}
