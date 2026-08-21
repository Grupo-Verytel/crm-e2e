import type { UsersService } from '../../auth/services/users.service';
import type { EntityType } from '../enums/entity-type.enum';

/** Result of a single workflow guard evaluation. */
export type GuardResult =
  | { ok: true }
  | { ok: false; guard: string; detalle: string };

/**
 * Context available to guards, destinatario resolvers, and titulo/mensaje.
 * `usersService` is injected by WorkflowEngineService when evaluating guards.
 */
export type WorkflowGuardContext = {
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  actorUserId: string;
  estadoAnterior: string | null;
  estadoNuevo: string;
  payload: Record<string, unknown>;
  /** Snapshot of the domain entity before the state write (optional). */
  entity?: { estado: string } | null;
  usersService?: UsersService;
};

export type WorkflowGuard = (
  ctx: WorkflowGuardContext,
) => GuardResult | Promise<GuardResult>;

export type DestinatarioSpec =
  | {
      tipo: 'usuario';
      resolver: (ctx: WorkflowGuardContext) => string;
    }
  | {
      tipo: 'rol';
      resolver: (ctx: WorkflowGuardContext) => string;
    };

export type WorkflowRule = {
  eventType: string;
  guards: WorkflowGuard[];
  destinatarios: DestinatarioSpec[];
  titulo: (ctx: WorkflowGuardContext) => string;
  mensaje: (ctx: WorkflowGuardContext) => string;
};
