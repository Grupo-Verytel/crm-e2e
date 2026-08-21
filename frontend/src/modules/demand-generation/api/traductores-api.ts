import { fetchUsers } from '../../auth/api/users-api';
import type { User } from '../../auth/types';

/**
 * Active TraductorDeNegocio users for business_referrer_id select.
 * Backend has findActiveByRoleName but no GET /users?role= filter yet —
 * load a page and filter client-side until a dedicated endpoint exists.
 */
export async function fetchTraductorReferrers(): Promise<User[]> {
  const data = await fetchUsers({ page: 1, limit: 100 });
  return data.items.filter(
    (user) => user.role_name === 'TraductorDeNegocio' && user.is_active,
  );
}
