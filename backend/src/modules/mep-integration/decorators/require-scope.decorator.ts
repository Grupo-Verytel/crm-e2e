import { SetMetadata } from '@nestjs/common';
import { MepScope } from '../constants/scopes';

export const REQUIRED_SCOPE_KEY = 'mepRequiredScope';

/** Declara el scope exigido por la operación (§10.2). */
export const RequireScope = (scope: MepScope) =>
  SetMetadata(REQUIRED_SCOPE_KEY, scope);
