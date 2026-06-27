import { SetMetadata } from '@nestjs/common';

export interface RequiredAbility {
  action: string;
  subject: string;
}

export const CHECK_ABILITY_KEY = 'checkAbility';

export const CheckAbility = (...abilities: RequiredAbility[]) =>
  SetMetadata(CHECK_ABILITY_KEY, abilities);
