import { SetMetadata } from '@nestjs/common';
import { RateLimitClass } from '../constants/rate-limit.constants';

export const RATE_LIMIT_CLASS_KEY = 'mepRateLimitClass';

/** Declara la clase de cuota de la operación (§11.1). */
export const RateLimited = (rateLimitClass: RateLimitClass) =>
  SetMetadata(RATE_LIMIT_CLASS_KEY, rateLimitClass);
