import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { AppLayout } from '../../../layout/AppLayout';
import { Pagination } from '../../../components/Pagination';
import { formatDateTime } from '../../../lib/format';
import { createUser, fetchUsers, updateUser } from '../api/users-api';
import { fetchRoles, updateRole } from '../api/roles-api';
import { RoleEditModal } from '../components/RoleEditModal';
import { UserFormModal } from '../components/UserFormModal';
import type { Role, User } from '../types';

type AdminTab = 'users' | 'roles';

export function AdminUsersPage() {
  const [tab, setTab] = useState<AdminTab>('users');
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<User | undefined>();

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const loadRoles = useCallback(async () => {
    const data = await fetchRoles();
    setRoles(data);
    return data;
  }, []);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchUsers({ page, limit });
      setUsers(data.items);
      setTotal(data.total);
    } catch {
      setError('No se pudo cargar la lista de usuarios.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (tab === 'users') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on tab/page change
      void loadUsers();
    }
  }, [tab, loadUsers]);

  function openCreateUser() {
    setUserModalMode('create');
    setSelectedUser(undefined);
    setUserModalOpen(true);
  }

  function openEditUser(user: User) {
    setUserModalMode('edit');
    setSelectedUser(user);
    setUserModalOpen(true);
  }

  function openEditRole(role: Role) {
    setSelectedRole(role);
    setRoleModalOpen(true);
  }

  return (
    <AppLayout title="Usuarios y roles">
      <div className="rounded bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-4">
          <div className="flex gap-1">
            <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
              Usuarios
            </TabButton>
            <TabButton active={tab === 'roles'} onClick={() => setTab('roles')}>
              Roles
            </TabButton>
          </div>

          {tab === 'users' ? (
            <button
              type="button"
              onClick={openCreateUser}
              className="my-3 inline-flex items-center gap-2 rounded bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              Nuevo usuario
            </button>
          ) : null}
        </div>

        {tab === 'users' ? (
          <>
            {isLoading ? (
              <StateMessage>Cargando usuarios…</StateMessage>
            ) : error ? (
              <StateMessage>{error}</StateMessage>
            ) : users.length === 0 ? (
              <StateMessage>
                No hay usuarios. Crea el primero con el botón Nuevo usuario.
              </StateMessage>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th className="px-4 py-3 font-bold">Nombre</th>
                      <th className="px-4 py-3 font-bold">Correo</th>
                      <th className="px-4 py-3 font-bold">Rol</th>
                      <th className="px-4 py-3 font-bold">Estado</th>
                      <th className="px-4 py-3 font-bold">Último acceso</th>
                      <th className="px-4 py-3 font-bold" />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.user_id} className="border-b border-border">
                        <td className="px-4 py-3 text-ink">{user.full_name}</td>
                        <td className="px-4 py-3 text-ink">{user.email}</td>
                        <td className="px-4 py-3 text-ink">{user.role_name}</td>
                        <td className="px-4 py-3">
                          <StatusBadge active={user.is_active} locked={Boolean(user.locked_until)} />
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {formatDateTime(user.last_login_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEditUser(user)}
                            className="rounded px-2 py-1 text-sm text-brand hover:bg-bg"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
          </>
        ) : (
          <div className="overflow-x-auto">
            {roles.length === 0 ? (
              <StateMessage>Cargando roles…</StateMessage>
            ) : (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-bold">Nombre</th>
                    <th className="px-4 py-3 font-bold">Descripción</th>
                    <th className="px-4 py-3 font-bold">Permisos</th>
                    <th className="px-4 py-3 font-bold" />
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.role_id} className="border-b border-border">
                      <td className="px-4 py-3 font-bold text-ink">{role.name}</td>
                      <td className="px-4 py-3 text-ink">{role.description ?? '—'}</td>
                      <td className="px-4 py-3 text-muted">{role.permissions.length}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEditRole(role)}
                          className="rounded px-2 py-1 text-sm text-brand hover:bg-bg"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <UserFormModal
        open={userModalOpen}
        mode={userModalMode}
        roles={roles}
        user={selectedUser}
        onClose={() => setUserModalOpen(false)}
        onSubmit={async (payload) => {
          if (userModalMode === 'create') {
            if (!payload.password) {
              throw new Error('Password required');
            }
            await createUser({
              email: payload.email,
              password: payload.password,
              full_name: payload.full_name,
              role_id: payload.role_id,
              is_active: payload.is_active,
            });
          } else if (selectedUser) {
            await updateUser(selectedUser.user_id, {
              email: payload.email,
              full_name: payload.full_name,
              role_id: payload.role_id,
              is_active: payload.is_active,
              password: payload.password,
            });
          }
          await loadUsers();
        }}
      />

      <RoleEditModal
        open={roleModalOpen}
        role={selectedRole}
        onClose={() => setRoleModalOpen(false)}
        onSubmit={async (payload) => {
          if (!selectedRole) {
            return;
          }
          const updated = await updateRole(selectedRole.role_id, payload);
          setRoles((current) =>
            current.map((role) => (role.role_id === updated.role_id ? updated : role)),
          );
        }}
      />
    </AppLayout>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'border-b-2 px-4 py-3 text-sm font-bold transition-colors',
        active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function StatusBadge({ active, locked }: { active: boolean; locked: boolean }) {
  if (locked) {
    return <span className="text-xs font-bold text-warning">Bloqueado</span>;
  }

  return (
    <span className={`text-xs font-bold ${active ? 'text-turquoise' : 'text-muted'}`}>
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function StateMessage({ children }: { children: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted">{children}</p>;
}
