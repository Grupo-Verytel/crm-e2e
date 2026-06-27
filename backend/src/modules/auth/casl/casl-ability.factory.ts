import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { CaslPermissionRule } from './casl-permission.interface';

export type AppAbility = MongoAbility<[string, string]>;

@Injectable()
export class CaslAbilityFactory {
  createForPermissions(permissions: CaslPermissionRule[]): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    for (const rule of permissions) {
      if (rule.conditions) {
        can(rule.action, rule.subject, rule.conditions as never);
      } else {
        can(rule.action, rule.subject);
      }
    }

    return build();
  }
}
