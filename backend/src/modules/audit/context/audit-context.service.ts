import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { AuditRequestContext } from './audit-context.interface';

@Injectable()
export class AuditContextService {
  private readonly storage = new AsyncLocalStorage<AuditRequestContext>();

  run<T>(context: AuditRequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  get(): AuditRequestContext | undefined {
    return this.storage.getStore();
  }
}
