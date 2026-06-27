export interface AuthenticatedUser {
  userId: string;
  roleName: string;
  permissions: import('../casl/casl-permission.interface').CaslPermissionRule[];
}
