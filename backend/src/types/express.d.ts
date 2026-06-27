import { AppAbility } from '../modules/auth/casl/casl-ability.factory';
import { AuthenticatedUser } from '../modules/auth/interfaces/authenticated-user.interface';

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}

    interface Request {
      user?: AuthenticatedUser;
      ability?: AppAbility;
    }
  }
}

export {};
